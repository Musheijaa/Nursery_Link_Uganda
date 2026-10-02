#!/usr/bin/env python3
"""Load Hansen Global Forest Change loss into forest_loss_cells, on a 1 km grid.

Clips the `lossyear` raster (and, optionally, `datamask`) to the pilot area, resamples it onto a
25 m grid in UTM zone 36N so each 1 km cell is exactly 40 x 40 pixels, and writes one row per
cell per year that had loss:

    geom            the 1 km cell (EPSG:4326 polygon; neighbouring cells share edges exactly)
    loss_pct        share of the cell's land (inside the pilot area) lost in that year, 0-100
    loss_year_from  the year (2001-2024 for GFC v1.12)
    loss_year_to    the same year

Per-year rows let a Nursery Shadow run choose its own `since_year` by summing years >= it.
The table is replaced in one transaction, and the load is recorded in audit_log.

Only GDAL (with its Python bindings and PostgreSQL driver) and numpy are needed. See README.md.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import unquote, urlparse

import numpy as np
from osgeo import gdal, ogr, osr

gdal.UseExceptions()
ogr.UseExceptions()
osr.UseExceptions()

UTM_36N = 32636  # Mukono and the whole of central/eastern Uganda
PIXEL_M = 25  # Hansen pixels are ~30 m; 25 m divides 1 km exactly
NODATA = 255
FIRST_YEAR = 2000  # lossyear 1 = 2001
MIN_COVERAGE = 0.10  # ignore cells with less than 10% of their area inside the pilot area


@dataclass(frozen=True)
class CellLoss:
    row: int  # 0 = northernmost
    col: int  # 0 = westernmost
    year: int
    pct: float


def aggregate(loss: np.ndarray, valid: np.ndarray, cell_px: int, first_year: int = FIRST_YEAR,
              min_coverage: float = MIN_COVERAGE) -> list[CellLoss]:
    """Per-cell, per-year share of valid pixels lost.

    loss:  2-D array of lossyear codes (0 = no loss, n = year first_year + n)
    valid: 2-D bool array, True for land pixels inside the pilot area
    """
    rows, cols = loss.shape[0] // cell_px, loss.shape[1] // cell_px
    if rows == 0 or cols == 0:
        return []
    loss = loss[: rows * cell_px, : cols * cell_px]
    valid = valid[: rows * cell_px, : cols * cell_px]

    def per_cell(mask: np.ndarray) -> np.ndarray:
        return mask.reshape(rows, cell_px, cols, cell_px).sum(axis=(1, 3))

    valid_counts = per_cell(valid)
    usable = valid_counts >= min_coverage * cell_px * cell_px
    results: list[CellLoss] = []
    for code in np.unique(loss[valid]):
        if code == 0:
            continue
        lost = per_cell((loss == code) & valid)
        for r, c in zip(*np.nonzero((lost > 0) & usable)):
            pct = round(float(lost[r, c]) * 100.0 / float(valid_counts[r, c]), 2)
            results.append(CellLoss(int(r), int(c), first_year + int(code), pct))
    results.sort(key=lambda x: (x.row, x.col, x.year))
    return results


def grid_vertices(xmin: float, ymax: float, rows: int, cols: int, cell_m: float) -> np.ndarray:
    """Lon/lat of every grid corner, shape (rows + 1, cols + 1, 2).

    Each corner is transformed once, so neighbouring cells share identical coordinates and
    PostGIS can dissolve them cleanly.
    """
    src = osr.SpatialReference()
    src.ImportFromEPSG(UTM_36N)
    dst = osr.SpatialReference()
    dst.ImportFromEPSG(4326)
    dst.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    transform = osr.CoordinateTransformation(src, dst)
    xs = xmin + np.arange(cols + 1) * cell_m
    ys = ymax - np.arange(rows + 1) * cell_m
    points = [(float(x), float(y)) for y in ys for x in xs]
    lonlat = np.array([(round(p[0], 7), round(p[1], 7)) for p in transform.TransformPoints(points)])
    return lonlat.reshape(rows + 1, cols + 1, 2)


def cell_wkt(vertices: np.ndarray, row: int, col: int) -> str:
    ring = [vertices[row, col], vertices[row, col + 1], vertices[row + 1, col + 1], vertices[row + 1, col], vertices[row, col]]
    return "POLYGON((" + ",".join(f"{lon:.7f} {lat:.7f}" for lon, lat in ring) + "))"


def pg_connection(url: str) -> str:
    """postgres://user:pass@host:port/db -> GDAL's PG: connection string."""
    u = urlparse(url)
    parts = {
        "host": u.hostname,
        "port": u.port,
        "dbname": (u.path or "/").lstrip("/"),
        "user": unquote(u.username) if u.username else None,
        "password": unquote(u.password) if u.password else None,
    }
    return "PG:" + " ".join(f"{k}='{v}'" for k, v in parts.items() if v)


def load_aoi(args: argparse.Namespace) -> ogr.Geometry:
    """The pilot area in EPSG:4326, from a GeoJSON file or a district in admin_boundaries."""
    if args.aoi:
        ds = ogr.Open(str(args.aoi))
        union = None
        for feature in ds.GetLayer():
            geom = feature.GetGeometryRef().Clone()
            union = geom if union is None else union.Union(geom)
        if union is None:
            sys.exit(f"{args.aoi} has no features")
        return union
    ds = ogr.Open(pg_connection(args.db))
    name = args.district.replace("'", "''")
    result = ds.ExecuteSQL(f"SELECT ST_AsText(geom) AS wkt FROM admin_boundaries WHERE level = 'district' AND name = '{name}'")
    feature = result.GetNextFeature()
    wkt = feature.GetField("wkt") if feature else None
    ds.ReleaseResultSet(result)
    if not wkt:
        sys.exit(f"District '{args.district}' not found in admin_boundaries")
    return ogr.CreateGeometryFromWkt(wkt)


def warp(sources: list[str], aoi: ogr.Geometry, bounds: tuple[float, float, float, float]) -> np.ndarray:
    """Mosaic, clip to the pilot area and resample onto the 25 m UTM grid. Outside = NODATA."""
    vrt = gdal.BuildVRT("", sources)
    out = gdal.Warp(
        "", vrt, format="MEM", dstSRS=f"EPSG:{UTM_36N}", outputBounds=bounds, xRes=PIXEL_M, yRes=PIXEL_M,
        resampleAlg="near", dstNodata=NODATA, cutlineWKT=aoi.ExportToWkt(), cutlineSRS="EPSG:4326",
    )
    return out.GetRasterBand(1).ReadAsArray()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--lossyear", nargs="+", required=True, help="Hansen GFC lossyear GeoTIFF tile(s) covering the pilot area")
    parser.add_argument("--datamask", nargs="+", help="Matching datamask tile(s); water and no-data pixels are left out")
    area = parser.add_mutually_exclusive_group()
    area.add_argument("--district", default="Mukono", help="District name in admin_boundaries (default: Mukono)")
    area.add_argument("--aoi", type=Path, help="GeoJSON of the pilot area instead of a district")
    parser.add_argument("--db", help="Database URL (e.g. $DATABASE_URL); needed to load, or to read --district")
    parser.add_argument("--out", type=Path, help="Also write the cells to this GeoJSON file")
    parser.add_argument("--dry-run", action="store_true", help="Compute (and write --out) without touching the database")
    parser.add_argument("--cell-m", type=int, default=1000, help="Cell size in metres (default 1000)")
    args = parser.parse_args(argv)

    if args.cell_m % PIXEL_M:
        parser.error(f"--cell-m must be a multiple of {PIXEL_M}")
    if not args.db and (not args.aoi or not args.dry_run):
        parser.error("--db is required unless both --aoi and --dry-run are given")

    aoi = load_aoi(args)
    utm = osr.SpatialReference()
    utm.ImportFromEPSG(UTM_36N)
    wgs84 = osr.SpatialReference()
    wgs84.ImportFromEPSG(4326)
    wgs84.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    aoi_utm = aoi.Clone()
    aoi_utm.AssignSpatialReference(wgs84)
    aoi_utm.TransformTo(utm)
    minx, maxx, miny, maxy = aoi_utm.GetEnvelope()
    # Snap outwards to whole cells so the grid is the same on every run
    c = args.cell_m
    bounds = (np.floor(minx / c) * c, np.floor(miny / c) * c, np.ceil(maxx / c) * c, np.ceil(maxy / c) * c)

    loss = warp(args.lossyear, aoi, bounds)
    valid = loss != NODATA
    if args.datamask:
        mask = warp(args.datamask, aoi, bounds)
        valid &= mask == 1  # 1 = land, 2 = water, 0 = no data

    cell_px = args.cell_m // PIXEL_M
    cells = aggregate(loss, valid, cell_px)
    rows, cols = loss.shape[0] // cell_px, loss.shape[1] // cell_px
    vertices = grid_vertices(bounds[0], bounds[3], rows, cols, args.cell_m)
    years = sorted({x.year for x in cells})
    print(f"{rows} x {cols} grid, {len({(x.row, x.col) for x in cells})} cells with loss, {len(cells)} cell-years"
          + (f", {years[0]}-{years[-1]}" if years else ""))

    if args.out:
        features = [
            {"type": "Feature", "geometry": ogr.CreateGeometryFromWkt(cell_wkt(vertices, x.row, x.col)).ExportToJson(),
             "properties": {"loss_pct": x.pct, "year": x.year}}
            for x in cells
        ]
        for f in features:
            f["geometry"] = json.loads(f["geometry"])
        args.out.write_text(json.dumps({"type": "FeatureCollection", "features": features}))
        print(f"Wrote {args.out}")

    if args.dry_run:
        return 0

    ds = ogr.Open(pg_connection(args.db), update=1)
    ds.StartTransaction()
    try:
        ds.ExecuteSQL("DELETE FROM forest_loss_cells")
        batch = 500
        for i in range(0, len(cells), batch):
            values = ",".join(
                f"(ST_GeomFromText('{cell_wkt(vertices, x.row, x.col)}', 4326), {x.pct}, {x.year}, {x.year})" for x in cells[i : i + batch]
            )
            ds.ExecuteSQL(f"INSERT INTO forest_loss_cells (geom, loss_pct, loss_year_from, loss_year_to) VALUES {values}")
        summary = json.dumps({
            "sources": [Path(p).name for p in args.lossyear + (args.datamask or [])],
            "area": str(args.aoi.name) if args.aoi else args.district,
            "cell_m": args.cell_m, "rows": len(cells), "years": [years[0], years[-1]] if years else None,
        }).replace("'", "''")
        ds.ExecuteSQL(
            "INSERT INTO audit_log (actor_id, action, entity, entity_id, after) "
            f"VALUES (NULL, 'forest_loss.load', 'forest_loss_cells', NULL, '{summary}'::jsonb)"
        )
        ds.CommitTransaction()
    except Exception:
        ds.RollbackTransaction()
        raise
    print(f"Loaded {len(cells)} rows into forest_loss_cells")
    return 0


if __name__ == "__main__":
    sys.exit(main())

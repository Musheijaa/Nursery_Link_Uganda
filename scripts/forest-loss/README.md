# Forest-loss loader

Loads tree-cover loss from the **Hansen Global Forest Change** dataset into `forest_loss_cells`, the input of the Nursery Shadow analysis (`POST /api/v1/admin/shadow/runs`). This is the only Python in the repository.

## What it does

1. Mosaics the `lossyear` tile(s) you give it and clips them to the pilot area. The area is the district outline from `admin_boundaries` (default `Mukono`) or a GeoJSON file.
2. Resamples onto a 25 m grid in UTM zone 36N (EPSG:32636), so a 1 km cell is exactly 40 × 40 pixels. The grid is snapped to whole kilometres, so it's identical on every run.
3. For each 1 km cell and each year, computes `loss_pct`: the share of the cell's valid pixels first lost that year.
   - A valid pixel is inside the pilot area and, if `--datamask` is given, on land.
   - Cells with less than 10% of their area inside the pilot area are skipped.
4. Replaces the contents of `forest_loss_cells` in **one transaction**, with one row per cell per year with loss (`loss_year_from = loss_year_to = year`), and records the load in `audit_log` (`forest_loss.load`).

Rows are per year so that each shadow run can choose its own `since_year`: it adds up a cell's years from `since_year` onwards. Neighbouring cells share exactly the same corner coordinates, so PostGIS dissolves them cleanly into shadow zones.

## Get the data

Hansen et al. (2013), *High-Resolution Global Maps of 21st-Century Forest Cover Change*, Science 342, and the annual updates. It is published under CC BY 4.0, and the source must be credited wherever results are shown. Downloads: <https://storage.googleapis.com/earthenginepartners-hansen/GFC-2024-v1.12/download.html>. Check that page for the latest version, and update the version in the file names below.

Tiles are 10° × 10° and named after their **top-left** corner. Mukono needs two:

- `10N_030E` covers the mainland (0°–10°N).
- `00N_030E` covers the Koome islands, just south of the equator.

```bash
mkdir -p data/gfc && cd data/gfc     # data/ is gitignored
V=GFC-2024-v1.12
for layer in lossyear datamask; do
  for tile in 10N_030E 00N_030E; do
    curl -fLO "https://storage.googleapis.com/earthenginepartners-hansen/$V/Hansen_${V}_${layer}_${tile}.tif"
  done
done
```

Each tile is 100–300 MB.

## Run

With the database up (`docker compose up -d db`), migrated and seeded, the easiest way is the official GDAL image, which has everything needed:

```bash
set -a; . ./.env; set +a
docker run --rm --network host -v "$PWD":/repo -w /repo ghcr.io/osgeo/gdal:ubuntu-small-3.9.3 \
  python3 scripts/forest-loss/forest_loss.py \
    --lossyear data/gfc/*lossyear*.tif \
    --datamask data/gfc/*datamask*.tif \
    --db "$DATABASE_URL"
```

Or run it locally, with `pip install -r scripts/forest-loss/requirements.txt` against a system GDAL of 3.6 or later.

| Option | |
|---|---|
| `--lossyear` | One or more `lossyear` tiles (required) |
| `--datamask` | Matching `datamask` tiles. Water and no-data pixels are left out of each cell's share. Recommended, because Mukono borders Lake Victoria |
| `--district NAME` | Pilot area from `admin_boundaries` (default `Mukono`) |
| `--aoi FILE` | Pilot area from a GeoJSON file instead |
| `--db URL` | Database to load into (e.g. `$DATABASE_URL`) |
| `--out FILE` | Also write the cells as GeoJSON, for a quick look in QGIS |
| `--dry-run` | Compute (and write `--out`) without changing the database |
| `--cell-m` | Cell size in metres (default 1000; must be a multiple of 25) |

A Mukono run takes a few seconds and produces a grid of about 78 × 40 cells.

## After loading

The shadow cache notices the new data automatically, so the next `POST /admin/shadow/runs` computes a fresh run.

**Placeholder outline:** until the real district outline replaces the placeholder (see `TODO(boundaries)` in `apps/api/src/db/seed/boundaries.ts`), loss is clipped to that placeholder.

## Tests

```bash
docker run --rm -v "$PWD/scripts/forest-loss":/w -w /w -e PYTHONDONTWRITEBYTECODE=1 \
  ghcr.io/osgeo/gdal:ubuntu-small-3.9.3 python3 -m unittest -v
```

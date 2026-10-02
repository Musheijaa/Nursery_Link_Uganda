#!/usr/bin/env python3
"""
Turns the two generated spreadsheets ("File 1 … nurseries and contacts.xlsx" and "File 2 … stock and
prices.xlsx") into apps/api/src/db/demo/demo-nurseries.json.gz, loaded by `pnpm db:demo-nurseries`.

The spreadsheets are invented test data (placeholder sub-counties such as "SubCounty-Zone-1", ten
manager names, coordinates scattered across whole regions), but their phone numbers and email
addresses are real-format and could belong to real people. So this keeps only what is safe to publish:

  - kept: reference, nursery name, manager name, ownership type, district, capacity, certification,
    stock (tree, quantity, price);
  - dropped: phone numbers, email addresses, parishes/villages, certificate numbers, and the
    invented links to real sponsors (WWF, ECOTRUST, Ministry of Water & Environment);
  - stock lines priced 0 are dropped (they are not for sale); a tree listed twice is merged;
  - each nursery gets a fixed spot inside its named district (official UBOS boundaries), not in a
    lake (Natural Earth 1:10m lakes, public domain), chosen with a random generator seeded by its
    reference, so re-running gives the same places.

Usage (needs openpyxl):
  python3 scripts/demo-nurseries/convert.py NURSERIES.xlsx STOCK.xlsx LAKES.geojson
LAKES.geojson: ne_10m_lakes clipped to Uganda (https://www.naturalearthdata.com/downloads/10m-physical-vectors/).
"""
import gzip
import json
import random
import sys
from collections import defaultdict
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[2]
BOUNDARIES = ROOT / 'apps/api/src/db/seed/data/uga-boundaries.geojson.gz'
OUT = ROOT / 'apps/api/src/db/demo/demo-nurseries.json.gz'

SPECIES = {
    'Milicia excelsa': 'mvule',
    'Maesopsis eminii': 'musizi',
    'Khaya anthotheca': 'african-mahogany',
    'Grevillea robusta': 'grevillea',
    'Calliandra calothyrsus': 'calliandra',
    'Persea americana': 'hass-avocado',
    'Mangifera indica': 'mango',
    'Eucalyptus grandis': 'eucalyptus-grandis',
    'Pinus caribaea': 'caribbean-pine',
    'Prunus africana': 'prunus-africana',
    'Azadirachta indica': 'neem',
}
TYPES = {'Individual': 'private', 'Company': 'commercial', 'Community Group': 'community', 'Institution': 'community'}
CERTIFICATION = {'Standard-certified': 'certified', 'Pending': 'pending', 'Unverified': 'unverified'}


def rows(path):
    sheet = openpyxl.load_workbook(path, read_only=True, data_only=True).active
    it = sheet.iter_rows(values_only=True)
    header = next(it)
    return [dict(zip(header, r)) for r in it if r[0]]


def polygons(geometry):
    """Rings of a (Multi)Polygon as lists of (x, y): [[outer, hole, …], …]."""
    coords = geometry['coordinates']
    return [coords] if geometry['type'] == 'Polygon' else coords


def in_ring(x, y, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def in_geometry(x, y, polys):
    return any(in_ring(x, y, p[0]) and not any(in_ring(x, y, h) for h in p[1:]) for p in polys)


def bbox(polys):
    xs = [pt[0] for p in polys for pt in p[0]]
    ys = [pt[1] for p in polys for pt in p[0]]
    return min(xs), min(ys), max(xs), max(ys)


def main(nurseries_xlsx, stock_xlsx, lakes_geojson):
    boundaries = json.loads(gzip.decompress(BOUNDARIES.read_bytes()))
    districts = {f['properties']['name']: polygons(f['geometry']) for f in boundaries['features'] if f['properties']['level'] == 'district'}
    lakes = [polygons(f['geometry']) for f in json.loads(Path(lakes_geojson).read_text())['features']]

    def place(ref, district):
        polys = districts[district]
        x0, y0, x1, y1 = bbox(polys)
        rng = random.Random(ref)
        # Stay ~1 km inside the district outline, so the point is unambiguous after simplification
        margin = 0.01
        for _ in range(10_000):
            x, y = rng.uniform(x0, x1), rng.uniform(y0, y1)
            if not in_geometry(x, y, polys) or any(in_geometry(x, y, lake) for lake in lakes):
                continue
            if not all(in_geometry(x + dx, y + dy, polys) for dx, dy in ((margin, 0), (-margin, 0), (0, margin), (0, -margin))):
                continue
            return [round(x, 5), round(y, 5)]
        raise SystemExit(f'No dry land found in {district} for {ref}')

    stock = defaultdict(lambda: defaultdict(lambda: [0, 0, 0]))  # ref → slug → [quantity, weighted price sum, lines]
    dropped_free = 0
    for s in rows(stock_xlsx):
        slug = SPECIES.get(s['scientific_name'])
        if slug is None:
            raise SystemExit(f"Unknown tree {s['scientific_name']!r}")
        qty, price = int(s['quantity_available']), int(s['price_per_seedling_ugx'])
        if price <= 0:
            dropped_free += 1
            continue
        line = stock[s['nursery_id']][slug]
        line[0] += qty
        line[1] += qty * price
        line[2] += 1

    out = []
    for n in rows(nurseries_xlsx):
        ref, district = n['nursery_id'], n['district']
        if district not in districts:
            raise SystemExit(f'Unknown district {district!r} for {ref}')
        lines = [[slug, q, int(round(total / q / 50) * 50) or 50] for slug, (q, total, _) in sorted(stock[ref].items()) if q > 0]
        out.append({
            'ref': ref,
            'name': n['nursery_name'],
            'type': TYPES[n['ownership_type']],
            'operator': n['manager_name'],
            'district': district,
            'location': place(ref, district),
            'annual_capacity': int(n['production_capacity_annual']),
            'certification': CERTIFICATION[n['certification_status']],
            'years': int(n['years_of_operation']),
            'stock': lines,
        })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        'about': 'Invented sample nurseries for development and demos (generated spreadsheets, cleaned by scripts/demo-nurseries/convert.py). Not real nurseries; no real contact details.',
        'nurseries': out,
    }
    OUT.write_bytes(gzip.compress(json.dumps(payload, separators=(',', ':')).encode(), 9))
    print(f'{len(out)} nurseries, {sum(len(n["stock"]) for n in out)} stock lines ({dropped_free} free lines dropped) → {OUT}')


if __name__ == '__main__':
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    main(*sys.argv[1:])

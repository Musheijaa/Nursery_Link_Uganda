#!/usr/bin/env bash
# Rebuilds apps/api/src/db/seed/data/uga-boundaries.geojson.gz from the official boundaries:
# Uganda Bureau of Statistics (UBOS) administrative boundaries, published by OCHA on the Humanitarian
# Data Exchange as "cod-ab-uga" (CC BY-IGO 3.0). Districts are admin level 2, sub-counties level 4.
#
# Needs Docker (GDAL image) and Node (npx mapshaper). Run from the repository root.
#
#   - Simplified to 20% of the vertices with mapshaper, which keeps shared borders shared (no gaps or
#     overlaps between neighbours). Measured against the originals: 94 m average, 207 m at the 95th
#     percentile; slivers under ~0.02 km² are removed.
#   - Districts are dissolved from their own sub-counties, so "inside a district" and "inside one of
#     its sub-counties" always agree.
set -euo pipefail

URL='https://data.humdata.org/dataset/6d6d1495-196b-49d0-86b9-dc9022cde8e7/resource/7804b4f7-064c-4bb4-a95d-4439fd658090/download/uga_admin_boundaries.shp.zip'
OUT="$(pwd)/apps/api/src/db/seed/data/uga-boundaries.geojson.gz"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

curl -sSL -o "$WORK/uga.zip" "$URL"
unzip -q "$WORK/uga.zip" -d "$WORK"
docker run --rm -v "$WORK:/d" ghcr.io/osgeo/gdal:ubuntu-small-3.9.3 ogr2ogr -f GeoJSON /d/sub.geojson /d/uga_admin4.shp -t_srs EPSG:4326 \
  -sql "SELECT adm4_name AS name, adm4_pcode AS code, adm2_name AS district, adm2_pcode AS district_code FROM uga_admin4" \
  -lco COORDINATE_PRECISION=6

cd "$WORK"
npx -y mapshaper@0.6 sub.geojson -clean -simplify 20% keep-shapes planar -clean \
  -o sub.json format=geojson precision=0.00001 \
  -dissolve district_code copy-fields=district -o dist.json format=geojson precision=0.00001

node -e '
const fs = require("fs");
const sub = JSON.parse(fs.readFileSync("sub.json", "utf8")).features;
const dist = JSON.parse(fs.readFileSync("dist.json", "utf8")).features;
const features = [
  ...dist.map(f => ({ type: "Feature", properties: { code: f.properties.district_code, name: f.properties.district, level: "district", parent_code: null }, geometry: f.geometry })),
  ...sub.map(f => ({ type: "Feature", properties: { code: f.properties.code, name: f.properties.name, level: "sub_county", parent_code: f.properties.district_code }, geometry: f.geometry })),
];
fs.writeFileSync("out.geojson", JSON.stringify({
  type: "FeatureCollection",
  source: "Uganda Bureau of Statistics (UBOS) via OCHA HDX cod-ab-uga, CC BY-IGO 3.0; simplified (mapshaper 20%)",
  features,
}));
'
gzip -9 -c out.geojson > "$OUT"
echo "Wrote $OUT"

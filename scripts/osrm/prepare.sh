#!/usr/bin/env bash
# Downloads the Uganda OpenStreetMap extract from Geofabrik and preprocesses it for OSRM
# (car profile, MLD algorithm). Output goes to data/osrm/, which is git-ignored.
#
# Usage: scripts/osrm/prepare.sh [--force]
#   --force   re-download and rebuild even if the data is recent
set -euo pipefail

IMAGE="ghcr.io/project-osrm/osrm-backend:v6.0.0"
URL="https://download.geofabrik.de/africa/uganda-latest.osm.pbf"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DATA="$ROOT/data/osrm"
PBF="$DATA/uganda-latest.osm.pbf"
MAX_AGE_DAYS=7

mkdir -p "$DATA"

if [[ "${1:-}" == "--force" ]] || [[ ! -f "$PBF" ]] || [[ -n "$(find "$PBF" -mtime +"$MAX_AGE_DAYS" 2>/dev/null)" ]]; then
  echo "Downloading $URL"
  curl --fail --location --retry 3 --output "$PBF.part" "$URL"
  mv "$PBF.part" "$PBF"
  rm -f "$DATA"/uganda-latest.osrm*
else
  echo "Using existing extract (less than $MAX_AGE_DAYS days old): $PBF"
fi

if [[ -f "$DATA/uganda-latest.osrm.mldgr" ]]; then
  echo "OSRM data already prepared. Use --force to rebuild."
  exit 0
fi

run() { docker run --rm -t -v "$DATA:/data" "$IMAGE" "$@"; }

echo "Extracting road network (car profile)…"
run osrm-extract -p /opt/car.lua /data/uganda-latest.osm.pbf
echo "Partitioning…"
run osrm-partition /data/uganda-latest.osrm
echo "Customising…"
run osrm-customize /data/uganda-latest.osrm

echo "Done. Start routing with: docker compose --profile routing up -d osrm"

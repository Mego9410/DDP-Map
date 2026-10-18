#!/usr/bin/env bash
# One-off: cut the WDW vector map extract the app serves for offline use (TRD §2).
# Needs the go-pmtiles CLI: https://github.com/protomaps/go-pmtiles/releases
#
#   scripts/tiles.sh            uses today's daily Protomaps build
#   scripts/tiles.sh 20261015   uses a specific build date
set -euo pipefail
cd "$(dirname "$0")/.."
DATE="${1:-$(date -u -d 'yesterday' +%Y%m%d 2>/dev/null || date -u -v-1d +%Y%m%d)}"
mkdir -p public/tiles
pmtiles extract "https://build.protomaps.com/${DATE}.pmtiles" public/tiles/wdw.pmtiles \
  --bbox=-81.62,28.33,-81.50,28.43 --maxzoom=18
ls -lh public/tiles/wdw.pmtiles
echo "Done. The file is git-ignored; it is uploaded with the Vercel deploy (see README)."

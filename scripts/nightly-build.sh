#!/usr/bin/env bash
# Nightly rebuild + quality report. Reads the raw crawl snapshots (read-only, so
# it is safe to run while the crawlers are live) and regenerates dist/latest +
# dist/latest/REPORT.md. Driven by aushadhi-build.timer on DD.
set -uo pipefail
cd "$(dirname "$0")/.."
echo "$(date -u '+%FT%TZ') nightly-build start"
npm run build   # heap ceiling (--max-old-space-size) lives in the package.json script
npm run report
echo "$(date -u '+%FT%TZ') nightly-build done"

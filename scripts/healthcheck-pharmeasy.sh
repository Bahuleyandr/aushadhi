#!/usr/bin/env bash
set -uo pipefail
export AUSHADHI_SERVICE=aushadhi-pharmeasy.service
export AUSHADHI_SOURCE=pharmeasy
exec "$(dirname "$0")/healthcheck.sh"

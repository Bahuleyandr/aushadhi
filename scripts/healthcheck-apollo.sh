#!/usr/bin/env bash
set -uo pipefail
export AUSHADHI_SERVICE=aushadhi-apollo.service
export AUSHADHI_SOURCE=apollo
exec "$(dirname "$0")/healthcheck.sh"

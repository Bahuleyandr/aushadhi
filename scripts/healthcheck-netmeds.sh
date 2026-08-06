#!/usr/bin/env bash
set -uo pipefail
export AUSHADHI_SERVICE=aushadhi-netmeds.service
export AUSHADHI_SOURCE=netmeds
exec "$(dirname "$0")/healthcheck.sh"

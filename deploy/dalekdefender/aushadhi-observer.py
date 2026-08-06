#!/usr/bin/env python3
"""Root-owned fixed observer dispatcher; repository code runs only as aushadhi."""
from __future__ import annotations

import os
import subprocess
import sys

WRAPPER_ERROR_RC = 125
WRAPPER_ERROR_SENTINEL = "AUSHADHI_OBSERVER_WRAPPER_ERROR:"
PREFIX = [
    "/usr/sbin/runuser", "-u", "aushadhi", "--", "/usr/bin/env", "-i",
    "HOME=/var/cache/aushadhi/runtime-home",
    "XDG_CACHE_HOME=/var/cache/aushadhi",
    "AUSHADHI_REPO_ROOT=/opt/aushadhi",
    "PATH=/usr/local/bin:/usr/bin:/bin",
    "LANG=C.UTF-8",
]
COMMANDS: dict[str, list[str]] = {
    "healthcheck-crawl": PREFIX + ["/usr/bin/bash", "/opt/aushadhi/scripts/healthcheck.sh"],
    "healthcheck-apollo": PREFIX + ["/usr/bin/bash", "/opt/aushadhi/scripts/healthcheck-apollo.sh"],
    "healthcheck-netmeds": PREFIX + ["/usr/bin/bash", "/opt/aushadhi/scripts/healthcheck-netmeds.sh"],
    "healthcheck-pharmeasy": PREFIX + ["/usr/bin/bash", "/opt/aushadhi/scripts/healthcheck-pharmeasy.sh"],
}


def dispatch(argv: list[str]) -> int:
    if len(argv) != 1 or argv[0] not in COMMANDS:
        raise ValueError("expected exactly one fixed observer action")
    proc = subprocess.run(
        COMMANDS[argv[0]],
        check=False,
        timeout=120,
        env={"PATH": "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", "LANG": "C.UTF-8"},
    )
    return proc.returncode


def main() -> int:
    if os.geteuid() != 0:
        print("REFUSED: observer dispatcher must run through its exact sudo rule", file=sys.stderr)
        return 2
    try:
        return dispatch(sys.argv[1:])
    except Exception as exc:
        print(f"{WRAPPER_ERROR_SENTINEL} {type(exc).__name__}: {exc}", file=sys.stderr)
        return WRAPPER_ERROR_RC


if __name__ == "__main__":
    raise SystemExit(main())

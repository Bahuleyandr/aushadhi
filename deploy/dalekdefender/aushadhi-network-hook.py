#!/usr/bin/env python3
"""Fixed root network hook for the four Aushadhi crawler units."""
from __future__ import annotations

import fcntl
import os
import stat
import subprocess
import sys
from pathlib import Path
from typing import Callable

SERVICES: dict[str, tuple[str, str, bool]] = {
    "aushadhi-crawl.service": ("0xa05", "4000", True),
    "aushadhi-apollo.service": ("0xa06", "3996", False),
    "aushadhi-netmeds.service": ("0xa08", "3994", False),
    "aushadhi-pharmeasy.service": ("0xa07", "3995", False),
}
ACTIONS = {"start", "stop"}
LAN_IF = "enx00e04c3e5d80"
IP = "/usr/sbin/ip"
IPTABLES = "/usr/sbin/iptables"
ROUTE_GUARD = "/usr/local/sbin/dalek-proton-route-guards"
LOCK = Path("/run/lock/aushadhi-network-hook.lock")
SAFE_ENV = {
    "PATH": "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    "LANG": "C.UTF-8",
}


def run_command(cmd: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        text=True,
        capture_output=True,
        check=check,
        timeout=60,
        env=SAFE_ENV,
    )


def _stop(
    service: str,
    mark: str,
    priority: str,
    route_guard: bool,
    run: Callable[..., subprocess.CompletedProcess[str]],
    *,
    strict_guard: bool,
) -> None:
    cgroup = f"system.slice/{service}"
    run(
        [IPTABLES, "-t", "nat", "-D", "POSTROUTING", "-o", LAN_IF,
         "-m", "mark", "--mark", mark, "-j", "MASQUERADE"],
        check=False,
    )
    run(
        [IPTABLES, "-t", "mangle", "-D", "OUTPUT", "-m", "cgroup",
         "--path", cgroup, "-j", "MARK", "--set-mark", mark],
        check=False,
    )
    run([IP, "rule", "del", "fwmark", mark, "lookup", "main", "priority", priority], check=False)
    if route_guard:
        run([ROUTE_GUARD, "aushadhi-stop"], check=strict_guard)


def apply_hook(
    service: str,
    action: str,
    *,
    run: Callable[..., subprocess.CompletedProcess[str]] = run_command,
) -> None:
    if service not in SERVICES:
        raise ValueError(f"unsupported service: {service}")
    if action not in ACTIONS:
        raise ValueError(f"unsupported action: {action}")
    mark, priority, route_guard = SERVICES[service]
    cgroup = f"system.slice/{service}"

    if action == "stop":
        _stop(service, mark, priority, route_guard, run, strict_guard=True)
        return

    try:
        run([IP, "rule", "del", "fwmark", mark, "lookup", "main", "priority", priority], check=False)
        run([IP, "rule", "add", "fwmark", mark, "lookup", "main", "priority", priority])

        mangle_check = [
            IPTABLES, "-t", "mangle", "-C", "OUTPUT", "-m", "cgroup",
            "--path", cgroup, "-j", "MARK", "--set-mark", mark,
        ]
        if run(mangle_check, check=False).returncode != 0:
            mangle_add = mangle_check.copy()
            mangle_add[mangle_add.index("-C")] = "-A"
            run(mangle_add)

        nat_check = [
            IPTABLES, "-t", "nat", "-C", "POSTROUTING", "-o", LAN_IF,
            "-m", "mark", "--mark", mark, "-j", "MASQUERADE",
        ]
        if run(nat_check, check=False).returncode != 0:
            nat_add = nat_check.copy()
            nat_add[nat_add.index("-C")] = "-A"
            run(nat_add)

        if route_guard:
            run([ROUTE_GUARD, "aushadhi-start"])
    except Exception:
        _stop(service, mark, priority, route_guard, run, strict_guard=False)
        raise


def parse_args(argv: list[str]) -> tuple[str, str]:
    if len(argv) != 2 or argv[0] not in SERVICES or argv[1] not in ACTIONS:
        raise ValueError("expected exact <aushadhi-service> <start|stop>")
    return argv[0], argv[1]


def acquire_lock():
    flags = os.O_RDWR | os.O_CLOEXEC | os.O_CREAT | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(LOCK, flags, 0o600)
    info = os.fstat(fd)
    if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_gid != 0 or stat.S_IMODE(info.st_mode) != 0o600:
        os.close(fd)
        raise RuntimeError("network lock ownership/type/mode invalid")
    return os.fdopen(fd, "w")


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    if os.geteuid() != 0:
        print("REFUSED: network hook must run as root from systemd", file=sys.stderr)
        return 2
    if len(argv) != 2 or argv[0] not in SERVICES or argv[1] not in ACTIONS:
        print("REFUSED: expected exact <aushadhi-service> <start|stop>", file=sys.stderr)
        return 2
    try:
        service, action = parse_args(argv)
        with acquire_lock() as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            apply_hook(service, action)
    except Exception as exc:
        print(f"NETWORK_HOOK_ERROR {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

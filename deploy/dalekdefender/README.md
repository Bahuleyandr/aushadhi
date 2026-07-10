# Dalekdefender deployment — aushadhi exhaustive crawler

Always-on 1mg crawler running on **dd** (dalekdefender). Single instance, polite
(2.5s/request, honest UA, robots-respected, hard-abort on block).

## Files

- `aushadhi-crawl.service` → `/etc/systemd/system/aushadhi-crawl.service`
- `aushadhi-crawl.service.d/splittunnel.conf` → drop-in of the same name
- The loop lives in the repo at `scripts/crawl-loop.sh` (WorkingDirectory `/root/aushadhi`).

## Install / update

```bash
cp aushadhi-crawl.service /etc/systemd/system/
mkdir -p /etc/systemd/system/aushadhi-crawl.service.d
cp aushadhi-crawl.service.d/splittunnel.conf /etc/systemd/system/aushadhi-crawl.service.d/
systemctl daemon-reload
systemctl enable --now aushadhi-crawl
```

## ⚠ Split-tunnel (load-bearing) — why the drop-in exists

dd runs **ProtonVPN** (`proton-is`, WireGuard, fwmark `0xca6c`, AllowedIPs `0.0.0.0/0`)
which sends all host traffic through a datacenter exit IP. **Cloudflare/1mg blocks
that exit IP with 403.** The drop-in routes ONLY this service's traffic out the
residential LAN path, leaving every other service on Proton:

1. **ip rule** `fwmark 0xa05 lookup main priority 4000` — marked traffic uses the
   main table (LAN default `192.168.68.1 dev enx00e04c3e5d80` → residential).
2. **mangle** `OUTPUT -m cgroup --path system.slice/aushadhi-crawl.service -j MARK
   --set-mark 0xa05` — marks only this service's cgroup.
3. **nat** `POSTROUTING -o enx00e04c3e5d80 -m mark 0xa05 -j MASQUERADE` — rewrites the
   source to the LAN IP. **Required**: the post-mangle reroute otherwise keeps
   Proton's tunnel source `10.2.0.2`, so replies never return (ETIMEDOUT).

Rules are added by `ExecStartPre` and removed by `ExecStopPost`, so nothing lingers
when the service is stopped, and a reboot re-installs them when systemd starts it.

Host-specific values baked in (change if the box changes): LAN NIC
`enx00e04c3e5d80`, LAN gateway `192.168.68.1`. Node prefers IPv6 but dd has no v6
default route, so fetches fall back to v4 over this split-tunnel (v6 attempts
ENETUNREACH fast, harmless).

## Verify

```bash
bash /root/aushadhi/scripts/healthcheck.sh          # OK / ALERT one-liner (Hermes uses this)
curl -s https://api.ipify.org                        # host default should still be the Proton IP
ip rule show | grep 0xa05                             # split-tunnel rule present while running
```

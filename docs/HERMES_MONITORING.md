# aushadhi crawler — monitoring brief for Hermes

**Task:** periodically confirm the aushadhi 1mg crawler on **dalekdefender (dd)** is
running and not crash-looping; if it is unhealthy, send one Discord alert. Do **not**
try to "fix" the dataset — this is liveness monitoring only.

## What it is / where

- **Service:** `aushadhi-crawl.service` (systemd, `enabled`, `Restart=always`) on **dd**.
- **What it does:** politely crawls Tata 1mg (2.5s/request, honest UA, robots-respected,
  hard-abort on repeated 403/429) to build an exhaustive Indian drug dataset. At the
  current 20,000-request cap, the minimum spacing plus normal jitter implies roughly
  14–15.3 hours of request activity before cap sleeps, excluding retries.
- **Home:** `/root/aushadhi`  ·  **log:** `/root/aushadhi/logs/crawl.log`  ·
  **progress state:** `/root/aushadhi/data/raw/onemg/state.json` · **cache-only activity:**
  today's `data/raw/onemg/<UTC-date>/normalized.jsonl`
- **Daily cap:** runtime-controlled by `AUSHADHI_DAILY_CAP`; the current DD unit uses
  `20000`. The healthcheck derives the cap from the running unit so monitoring does not
  silently retain an old hard-coded value. Cap resets at **UTC midnight = 05:30 IST**.

## The check (run on dd, this is the whole job)

```bash
bash /root/aushadhi/scripts/healthcheck.sh
```

- **exit 0** → healthy, prints `OK: ...` → do nothing.
- **exit 1** → unhealthy, prints `ALERT: ...` → **send that line to Discord** (see below).

Verified healthy output looks like:
```
OK: active and fetching (count=743/20000, activity=state:2s, logage=1803s, stateage=2s, outputage=4s, nrestarts=0). last='gapfill: ...'
```

The script distinguishes designed sleeps from real failures. During exhaustive gapfill,
the human-readable log can remain quiet while `state.json` advances; cache-only pages
instead append normalized rows without incrementing the request count. The healthcheck
therefore accepts fresh log, state, or current-day output activity. The Hermes wrapper
additionally compares counts across runs. A cap change or new daily cycle can reset the
counter; accept that rollover only when the service is active, restart count is stable,
and state/queue/output activity continues.

## The ONE stateful thing you must do: crash-loop detection

`Restart=always` means a single occasional restart is normal and self-heals. A **crash
loop** is the real failure. Each run, read `nrestarts=N` from the output and remember it:

- **Alert** if `nrestarts` climbs by **≥3 between two consecutive checks**, even if the
  script says OK that instant (systemd may have it briefly `active` between restarts).

## Do NOT alert on (these are healthy)

- `OK: ... sleeping as designed` or `daily cap reached` — expected daily idle window.
- A fresh `idle 20m` line — nothing queued this moment; normal. It stops being trusted
  after 30 minutes if neither the log nor state file advances.
- The word `CapReached` / "daily cap" in the log — normal end-of-day, **not** a crash.

## DO alert on (what exit 1 covers)

1. **Service not `active`** (`failed` / `inactive` / stuck `activating`).
2. **1mg BLOCK / robots failure** — log contains `aborting after` / `consecutive 403|429`
   / `refusing to crawl`. This one needs a **human decision** (may mean 1mg is pushing
   back — we may lower the cap or pause), not just a restart. A later complete healthy
   iteration supersedes stale block text in the ordered status stream. The loop enters an
   indefinite no-request hold on this condition until a human deliberately restarts it.
3. **Wedged** — service `active` but log silent >30 min while still **below** the daily
   cap and `state.json` is also stale (i.e. it should be fetching but isn't).
4. **Phase failure** — the loop logs `crawl-loop ERROR:` when build, discovery, or gapfill exits
   unexpectedly. A successful full iteration writes `crawl-loop HEALTHY:`; monitoring
   alerts while the newest durable phase marker remains an error.
5. **Crash loop** — the nrestarts rule above.

## What to send us (Discord)

One message to `#aushadhi-crawl`:
```
[aushadhi/dd] <the ALERT: ... line from healthcheck.sh> @ <UTC time>
```
The ALERT line already carries service state, nrestarts, count/cap, and the last log line
— that is enough for us to triage. No need to attach more.

## Remediation policy

- **Default: notify only.** systemd already auto-restarts transient crashes.
- Optional, safe: for a **wedged** alert only (#3), you may run
  `systemctl restart aushadhi-crawl` once, then still notify us.
- For a **block** alert (#2): do **not** restart in a loop (it would re-hit the block).
  The crawler is already held without further requests; notify, investigate, and restart
  only after deciding it is safe to resume. **Check the split-tunnel first** (below) — a
  403 storm is often the egress path flipping back to ProtonVPN, not an earned 1mg block.

## Split-tunnel (load-bearing egress — check this on any 403/block)

dd runs **ProtonVPN** (`proton-is`) whose datacenter exit IP Cloudflare/1mg **403s**. The
crawler is split-tunnelled out the residential LAN via three rules the systemd unit
installs (`ExecStartPre` in `deploy/dalekdefender/aushadhi-crawl.service.d/splittunnel.conf`):
`ip rule` fwmark `0xa05` → main table, a cgroup mangle mark, and a `MASQUERADE`. If a block
fires, verify the path before assuming an earned ban:

```bash
ssh root@dd 'ip rule show | grep 0xa05'                                   # rule present while running?
ssh root@dd 'curl -s --max-time 15 --interface enx00e04c3e5d80 -o /dev/null -w "%{http_code}\n" https://www.1mg.com/robots.txt'  # 200 = residential fine
ssh root@dd 'curl -s https://api.ipify.org'                               # host default should still be the Proton IP
```

`200` over the residential interface but `403` by default ⇒ split-tunnel dropped, not a ban;
`systemctl restart aushadhi-crawl` reinstalls the rules. See `deploy/dalekdefender/README.md`.

## Suggested cadence

Every **15–30 min**. Cheap local metadata/log check; catches a crash loop within one
interval.

## Human quick-reference (for us, once alerted)

```bash
ssh root@dd 'tail -30 /root/aushadhi/logs/crawl.log'          # what happened
ssh root@dd 'journalctl -u aushadhi-crawl -n 50 --no-pager'   # systemd view
ssh root@dd 'systemctl restart aushadhi-crawl'                # kick it
# lower the footprint: edit AUSHADHI_DAILY_CAP in
# /etc/systemd/system/aushadhi-crawl.service -> daemon-reload -> restart
```

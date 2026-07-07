# aushadhi crawler — monitoring brief for Hermes

**Task:** periodically confirm the aushadhi 1mg crawler on **dalekdefender (dd)** is
running and not crash-looping; if it is unhealthy, send one Telegram alert. Do **not**
try to "fix" the dataset — this is liveness monitoring only.

## What it is / where

- **Service:** `aushadhi-crawl.service` (systemd, `enabled`, `Restart=always`) on **dd**.
- **What it does:** politely crawls Tata 1mg (2.5s/request, honest UA, robots-respected,
  hard-abort on repeated 403/429) to build an exhaustive Indian drug dataset. Runs
  ~8h/day then sleeps against a daily cap.
- **Home:** `/root/aushadhi`  ·  **log:** `/root/aushadhi/logs/crawl.log`  ·
  **progress state:** `/root/aushadhi/data/raw/onemg/state.json`
- **Daily cap:** `AUSHADHI_DAILY_CAP=12000` (in the unit file). Cap resets at **UTC
  midnight = 05:30 IST**.

## The check (run on dd, this is the whole job)

```bash
bash /root/aushadhi/scripts/healthcheck.sh
```

- **exit 0** → healthy, prints `OK: ...` → do nothing.
- **exit 1** → unhealthy, prints `ALERT: ...` → **send that line to Telegram** (see below).

Verified healthy output looks like:
```
OK: active and fetching (count=743/12000, log 3s ago, nrestarts=0). last='discover: label=b page=53 ...'
```

The script already distinguishes real failures from the crawler's **designed sleeps**,
so a simple `if ! healthcheck.sh; then alert; fi` will not false-alarm at night.

## The ONE stateful thing you must do: crash-loop detection

`Restart=always` means a single occasional restart is normal and self-heals. A **crash
loop** is the real failure. Each run, read `nrestarts=N` from the output and remember it:

- **Alert** if `nrestarts` climbs by **≥3 between two consecutive checks**, even if the
  script says OK that instant (systemd may have it briefly `active` between restarts).

## Do NOT alert on (these are healthy)

- `OK: ... sleeping as designed` or `daily cap reached` — expected daily idle window
  (roughly 14:00 IST → 05:30 IST the crawler sits at `count=12000` and sleeps).
- `idle 20m` in the log — nothing queued this moment; normal.
- The word `CapReached` / "daily cap" in the log — normal end-of-day, **not** a crash.

## DO alert on (what exit 1 covers)

1. **Service not `active`** (`failed` / `inactive` / stuck `activating`).
2. **1mg BLOCK / robots failure** — log contains `aborting after` / `consecutive 403|429`
   / `refusing to crawl`. This one needs a **human decision** (may mean 1mg is pushing
   back — we may lower the cap or pause), not just a restart.
3. **Wedged** — service `active` but log silent >30 min while still **below** the daily
   cap (i.e. it should be fetching but isn't).
4. **Crash loop** — the nrestarts rule above.

## What to send us (Telegram)

One message, your existing watchdog channel:
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
  Just notify — we decide whether to back off.

## Suggested cadence

Every **15–30 min**. Cheap (one systemctl + a tail). Catches a crash loop within one
interval.

## Human quick-reference (for us, once alerted)

```bash
ssh root@dd 'tail -30 /root/aushadhi/logs/crawl.log'          # what happened
ssh root@dd 'journalctl -u aushadhi-crawl -n 50 --no-pager'   # systemd view
ssh root@dd 'systemctl restart aushadhi-crawl'                # kick it
# lower the footprint: edit AUSHADHI_DAILY_CAP in
# /etc/systemd/system/aushadhi-crawl.service -> daemon-reload -> restart
```

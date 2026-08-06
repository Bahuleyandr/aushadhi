# Aushadhi crawler monitoring brief for Hermes

This is a read-only monitoring contract for Dalekdefender. It authorizes no
restart, enablement, crawler resumption, routing change, deployment, or data
repair.

## Expected service state

| source | service | expected state |
|---|---|---|
| Tata 1mg | `aushadhi-crawl.service` | `inactive` and `disabled` — intentional operator hold |
| Apollo | `aushadhi-apollo.service` | `active/running` |
| PharmEasy | `aushadhi-pharmeasy.service` | `active/running` |
| Netmeds | `aushadhi-netmeds.service` | `active/running` |

The 1mg hold follows repeated request-heavy, zero-yield passes. Do not alert on
its documented `OK: onemg intentionally-disabled ...` result and do not enable
or start it. Resumption requires a tested release, a separately authorized
one-request source-health probe, and explicit approval.

## Exact checks

Run these fixed commands on Dalekdefender every 15–30 minutes:

```bash
sudo /usr/local/libexec/aushadhi-observer healthcheck-crawl
sudo /usr/local/libexec/aushadhi-observer healthcheck-apollo
sudo /usr/local/libexec/aushadhi-observer healthcheck-pharmeasy
sudo /usr/local/libexec/aushadhi-observer healthcheck-netmeds
```

The sudo policy permits only those four observer actions. It does not permit a
shell, arbitrary arguments, sampling, or service control. Repository code runs
as the unprivileged `aushadhi` account.

- Exit `0`, one `OK:` line: record the state; do not alert.
- Exit `1`, one `ALERT:` line: send the line to `#aushadhi-crawl`.
- Exit `125` with `AUSHADHI_OBSERVER_WRAPPER_ERROR:`: alert as a monitoring
  control failure; do not replace it with an ad-hoc privileged command.
- Any sudo/transport failure: alert that the check itself could not run.

Use this message format:

```text
[aushadhi/dd] <OK or ALERT line> @ <UTC timestamp>
```

Persist the reported `nrestarts` for the three active services. Alert if it
increases by three or more between consecutive checks, even if the current
health line is `OK`.

## What the health check evaluates

The common check derives the installed cap from the unit, requires the active
services to be `active/running`, and fails closed on a missing or invalid crawler
state file. It reports request count/cap, log/state/productive-output/index age,
zero-yield streak, and restart count.

The following are alerts requiring human review:

- a secondary crawler is inactive, failed, or active without a running main
  process;
- crawler state is missing or invalid;
- a robots, repeated 403/429, or source-block marker has placed the loop on
  human hold;
- the newest durable phase marker is a discovery/parser or other phase error;
- all accepted activity signals are stale outside a declared scheduled wait;
  or
- the restart counter crosses the threshold above.

The following are expected states, not restart triggers:

- the intentional 1mg inactive/disabled hold;
- a UTC daily-cap reset wait;
- the bounded six-hour no-work/completed-source idle;
- the one-hour fail-closed discovery-anomaly delay while it remains within its
  declared grace period; and
- a recent ordinary retry sleep.

Repeated zero-yield completion and stale productive output are explicit fleet
signals. They require a human assessment of index freshness and source coverage;
they do not authorize an automatic restart or more requests.

## Read-only fleet view

For a human investigation, run the fleet report as the runtime account:

```bash
sudo -u aushadhi env -i \
  HOME=/var/cache/aushadhi/runtime-home \
  XDG_CACHE_HOME=/var/cache/aushadhi \
  PATH=/usr/local/bin:/usr/bin:/bin \
  AUSHADHI_RAW_ROOT=/var/lib/aushadhi/data/raw \
  AUSHADHI_DIST_ROOT=/var/lib/aushadhi/dist \
  AUSHADHI_LOG_ROOT=/var/log/aushadhi \
  /usr/bin/node /opt/aushadhi/src/cli/fleet-status.mjs
```

It uses streaming JSONL counts and a bounded log tail. The report shows service
state, actual capped requests, durable cursor/index size, normalized-row count,
productive-output and index ages, quarantines/tombstones, repeated zero yield,
latest cohort/manifest size coherence, and free storage. Its ETA is shown only
when the source exposes a trustworthy numeric cursor and no unresolved
quarantine; otherwise it deliberately reports no ETA.

## Paths and escalation boundary

- immutable code and receipt: `/opt/aushadhi`,
  `/opt/aushadhi/DEPLOYED-RELEASE.json`
- crawler state: `/var/lib/aushadhi/data/raw/<source>`
- complete catalogue cohorts: `/var/lib/aushadhi/dist`
- bounded, source-scoped logs: `/var/log/aushadhi/<source>/`
- exported recovery snapshots: `/var/lib/aushadhi-export`

The crawler units use the fixed root-owned
`/usr/local/libexec/aushadhi-network-hook`; there are no shell-based systemd
drop-ins. On a routing or source-block alert, notify an operator. Do not add,
remove, or recreate policy-routing or iptables rules from monitoring.

`/usr/local/libexec/aushadhi-source-healthcheck` performs exactly one marked
1mg `robots.txt` request, rejects non-HTTP-200 results, and verifies cleanup. It
may run only as root while 1mg is inactive and only under separate authorization;
it is not part of the periodic Hermes job.

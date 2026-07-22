# Phase 4 — deploy runbook (operator / root)

Activates Phases 1–3 in production. All code is on the DD dev tree
(`/home/bahuleyan/aushadhi-completeness-fix`), tested (full suite 262/262) and
real-data-validated. This is an operator step (needs root); nothing here has been
executed. Deploy = `root-cp` (files are NOT in `HOTFIX_RELS`, so no
secondary-parser-hotfix ceremony). **No `npm install` needed** — the new modules use
only Node builtins.

## What ships

| file | change | /opt base (sha12) | new dev (sha12) |
|---|---|---|---|
| `src/lib/plausibility.mjs` | **new** — strength model | absent | `30c75381` |
| `src/lib/merge.mjs` | annotate rows (optional `model` param) | `ef999ae0` | `ff93dde5` |
| `src/cli/build.mjs` | build model + pass to merge + meta stats | `159ed13f` | `7c0e6feb` |
| `src/cli/prescribable.mjs` | **new** — clinical layer CLI | absent | `f0eec4fe` |
| `package.json` | `npm run prescribable` | `6978e0f7` | `d5718d96` |
| `scripts/nightly-build.sh` | build → prescribable → report | `0c82bfdf` | `aa4a61db` |
| `src/lib/report.mjs` | REPORT.md strength-verification section | `984e5b18` | `953896e8` |
| export snapshot (`/usr/local/sbin/aushadhi-export-snapshot`) | stage `prescribable.jsonl.zst` + review CSV, manifest schema 3 | — | `deploy/aushadhi_nonroot_v2_export_snapshot.sh` |

Path facts: `/opt/aushadhi/{dist,data}` are symlinks to `/var/lib/aushadhi/{dist,data}`;
the build runs as **root** (`aushadhi-build.service`, WorkingDirectory `/opt/aushadhi`);
the export runs as **aushadhi** (`aushadhi-export.service`).

## Pre-flight (bahuleyan, no root)
```bash
cd /home/bahuleyan/aushadhi-completeness-fix
for f in src/lib/plausibility.mjs src/lib/merge.mjs src/cli/build.mjs \
         src/cli/prescribable.mjs package.json scripts/nightly-build.sh src/lib/report.mjs; do
  printf '%s  %s\n' "$(sha256sum "$f" | cut -c1-8)" "$f"; done
# expect: 30c75381 plausibility · ff93dde5 merge · 7c0e6feb build · f0eec4fe prescribable
#         · d5718d96 package · aa4a61db nightly · 953896e8 report
node --test 2>&1 | tail -3   # 264/264
```

## Step 1 — backup current /opt (root)
```bash
ts=$(date -u +%Y%m%dT%H%M%SZ)
for f in src/lib/merge.mjs src/cli/build.mjs package.json scripts/nightly-build.sh src/lib/report.mjs; do
  sudo cp -a "/opt/aushadhi/$f" "/opt/aushadhi/$f.bak-$ts"; done
# plausibility.mjs + prescribable.mjs are new -> rollback = delete them
```

## Step 2 — deploy code (root)
```bash
D=/home/bahuleyan/aushadhi-completeness-fix
sudo cp "$D/src/lib/plausibility.mjs" /opt/aushadhi/src/lib/plausibility.mjs
sudo cp "$D/src/lib/merge.mjs"        /opt/aushadhi/src/lib/merge.mjs
sudo cp "$D/src/cli/build.mjs"        /opt/aushadhi/src/cli/build.mjs
sudo cp "$D/src/cli/prescribable.mjs" /opt/aushadhi/src/cli/prescribable.mjs
sudo cp "$D/package.json"             /opt/aushadhi/package.json
sudo cp "$D/scripts/nightly-build.sh" /opt/aushadhi/scripts/nightly-build.sh
sudo cp "$D/src/lib/report.mjs"       /opt/aushadhi/src/lib/report.mjs
# verify (should match the pre-flight shas)
for f in src/lib/plausibility.mjs src/lib/merge.mjs src/cli/build.mjs \
         src/cli/prescribable.mjs package.json scripts/nightly-build.sh src/lib/report.mjs; do
  printf '%s  %s\n' "$(sudo sha256sum "/opt/aushadhi/$f" | cut -c1-8)" "$f"; done
```

## Step 3 — first real end-to-end build (root)
Heavy (~minutes; re-reads all raw crawl data — safe while crawlers are live, read-only):
```bash
sudo bash -c 'cd /opt/aushadhi && npm run build && npm run prescribable'
date_tag=$(sudo bash -c "ls -1 /var/lib/aushadhi/dist | grep -E \"^[0-9]{4}-\" | sort | tail -1")
sudo ls -la "/var/lib/aushadhi/dist/$date_tag/"     # drugs.jsonl + prescribable.jsonl + strength-review-shortlist.csv + strength-conflicts.csv + REPORT.md
sudo wc -l "/var/lib/aushadhi/dist/$date_tag/prescribable.jsonl"   # ~313k
sudo head -1 "/var/lib/aushadhi/dist/$date_tag/prescribable.jsonl" | python3 -m json.tool | sed -n '1,25p'
# sanity: strength status split should look like verified~90% / unverified~6% / no_strength~3%
sudo python3 -c "import json,collections;c=collections.Counter(json.loads(l)['strength_status'] for l in open('/var/lib/aushadhi/dist/$date_tag/prescribable.jsonl'));print(c)"
```

## Step 4 — deploy export snapshot v2 (root)
```bash
systemctl cat aushadhi-export.service | grep -E 'ExecStart|User'   # confirm the script path + it runs as aushadhi
# install v2 to the path ExecStart uses (both are present today):
sudo cp /home/bahuleyan/aushadhi-completeness-fix/deploy/aushadhi_nonroot_v2_export_snapshot.sh /usr/local/sbin/aushadhi-export-snapshot
sudo cp /home/bahuleyan/aushadhi-completeness-fix/deploy/aushadhi_nonroot_v2_export_snapshot.sh /usr/local/libexec/aushadhi-export-snapshot
sudo chmod 0755 /usr/local/sbin/aushadhi-export-snapshot /usr/local/libexec/aushadhi-export-snapshot
# (if a bootstrap hash-pins the export script, re-run that bootstrap instead of raw cp — check first.)
# also refresh the bahuleyan source-of-truth copy:
cp /home/bahuleyan/aushadhi-completeness-fix/deploy/aushadhi_nonroot_v2_export_snapshot.sh /home/bahuleyan/aushadhi_nonroot_v2_export_snapshot.sh
```
Trigger + verify:
```bash
sudo systemctl start aushadhi-export.service
sudo systemctl status aushadhi-export.service --no-pager | tail -5
cat "/var/lib/aushadhi-export/$date_tag/stage-manifest.json" | python3 -c "import json,sys;d=json.load(sys.stdin);print('schema',d['schema_version'],'| prescribable',d['prescribable'] and d['prescribable']['record_count'],'| review',d['review_shortlist'])"
ls "/var/lib/aushadhi-export/$date_tag/"   # expect prescribable.jsonl.zst + strength-review-shortlist.csv
```

## Rollback (root)
```bash
ts=<the timestamp from Step 1>
for f in src/lib/merge.mjs src/cli/build.mjs package.json scripts/nightly-build.sh src/lib/report.mjs; do
  sudo cp -a "/opt/aushadhi/$f.bak-$ts" "/opt/aushadhi/$f"; done
sudo rm -f /opt/aushadhi/src/cli/prescribable.mjs /opt/aushadhi/src/lib/plausibility.mjs
# export: sudo cp /home/bahuleyan/<the pre-v2 backup> /usr/local/sbin/aushadhi-export-snapshot
```
`build.mjs` rollback restores `mergeRows(all)` (no model → no annotation) — fully safe.

## Safety notes
- `merge.mjs`/`build.mjs`/`plausibility.mjs`/`prescribable.mjs` are **not** in
  `HOTFIX_RELS`, so this deploy does not affect the secondary-parser-hotfix baselines.
- `build.mjs` change is backward-compatible; if `npm run prescribable` ever fails, it
  is a **separate** step after `npm run build`, so `drugs.jsonl` is still produced.
- Validated before deploy: full suite 262/262; `prescribable.mjs` EXACT-MATCH to the
  reviewed Python prototype on the real 477,783-row dataset (delta 0 on all metrics);
  export script v2 passes the existing security test 3/3 + stages the new artifacts
  (with graceful skip when absent).
- `REPORT.md` (written to `dist/latest/REPORT.md`) now includes a **Strength
  verification** section (`src/lib/report.mjs`); after Step 3 confirm with
  `sudo sed -n '/Strength verification/,/^## /p' /opt/aushadhi/dist/latest/REPORT.md`.

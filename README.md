# aushadhi

India drug reference builder: produces a versioned **brand → composition** dataset of drugs in the Indian market (~254k+ SKUs) from openly licensed datasets, official government sources (Jan Aushadhi, CDSCO), and a polite, capped Tata 1mg gap-filler.

Primary consumer: VH Health composition drug search (`drug_compositions` import + hospital catalog brand-matching).

- Design spec: [docs/superpowers/specs/2026-07-07-india-drug-reference-design.md](docs/superpowers/specs/2026-07-07-india-drug-reference-design.md)
- Artifacts land in `dist/<date>/` (gitignored — this repo is code only)
- MIMS is deliberately excluded (paywalled, copyrighted editorial content)

## Commands

```
npm run fetch     # download source snapshots (idempotent, cached)
npm run build     # normalize -> merge -> emit dist/<date>/
npm run gapfill   # polite 1mg gap-filler (rate-limited, capped, resumable)
npm run stats     # coverage/quality summary of latest dist
npm test          # node:test suite
```

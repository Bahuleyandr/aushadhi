// Prescribable (clinical) layer: collapse the SKU-level source-union drugs.jsonl into
// pack-agnostic prescribable medicines for VH Health.
//
//   - brand-core cross-source merge (the aggressive normalization DD's merge does not
//     do), so the same medicine from different sources unifies;
//   - PLAUSIBILITY swap resolution (reuses lib/plausibility.mjs) — fixes swaps even
//     when a "trusted" source had them (source-trust would guess wrong ~half the time);
//   - pack size collapsed (10s/15s/bottle is the pharmacist's dispensing choice),
//     preserved as nested pack_variants;
//   - OPTION B: a strength that cannot be verified is SUPPRESSED (molecules kept,
//     values nulled) and flagged strength_status='unverified';
//   - the small tail plausibility cannot decide is flagged strength_conflict for a
//     clinician / authoritative reference.
//
// Faithful JS port of tools/prescribable/build_prescribable.py (Excel output omitted).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { pathToFileURL } from 'node:url';
import { buildStrengthModel } from '../lib/plausibility.mjs';
import { releaseProfile, assignSubstituteGroups, formulationGroupRows } from '../lib/formulation.mjs';
import { writeCsvStream, writeJsonlStream } from '../lib/build-cohort.mjs';

const DROP = new Set(('tablet tablets tab tabs capsule capsules cap caps strip strips of in a an the '
  + 'bottle bottles syrup syrups injection injections inj vial vials ml mg mcg gm g kg iu '
  + 'dry oral suspension powder for solution drops drop cream gel ointment lotion sachet '
  + 'sachets tube tubes respules rotacap piece pieces pack packs kit s').split(/\s+/));
const UNITISH = /^\d+(\.\d+)?(mg|mcg|g|gm|ml|iu|%|)$/;
const RELEASE_WORD = /release/i;
const FORM_PATTERNS = [
  ['Injection', /injection|infusion|\binj\b|\bvial\b|ampoule/],
  ['Inhalation', /inhaler|rotacap|respule|inhalation/],
  ['Nasal/Spray', /nasal spray|\bspray\b/],
  ['Drops', /eye drop|ear drop|nasal drop|\bdrops?\b/],
  ['Topical', /cream|ointment|\bgel\b|lotion|\bsoap\b/],
  ['Oral Liquid', /syrup|suspension|elixir|\bsolution\b|\bliquid\b/],
  ['Powder/Sachet', /\bpowder\b|\bsachet\b/],
  ['Capsule', /capsule|\bcaps?\b/],
  ['Tablet', /tablet|\btabs?\b|\bdt\b/],
];
const SRC_PREF = { 'onemg-live': 0, 'github-jr': 1, 'netmeds': 2, 'pharmeasy': 3, 'apollo': 4 };
const SEP = '';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const round3 = (v) => Math.round(v * 1000) / 1000;
const fmt = (v) => String(v);

export function brandCore(bn) {
  const toks = String(bn ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  return toks.filter((x) => !(/^\d+$/.test(x) || UNITISH.test(x) || DROP.has(x))).join('');
}

export function normForm(brand, formRaw, pack) {
  const fr = (formRaw && RELEASE_WORD.test(formRaw)) ? '' : (formRaw || '');
  const text = [brand || '', pack || '', fr].filter(Boolean).join(' ').toLowerCase();
  for (const [label, pattern] of FORM_PATTERNS) if (pattern.test(text)) return label;
  return 'Other';
}

const cmpMolValUnit = (a, b) => {
  if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
  const an = a[1] === null; const bn = b[1] === null;
  if (an !== bn) return an ? 1 : -1;           // null value sorts last
  if ((a[1] ?? 0) !== (b[1] ?? 0)) return (a[1] ?? 0) - (b[1] ?? 0);
  return a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0;
};

export function sigOf(ings) {
  const arr = (ings ?? []).map((i) => [
    String(i?.molecule ?? '').toLowerCase().trim(),
    isNum(i?.strength_value) ? round3(i.strength_value) : null,
    String(i?.strength_unit ?? '').toLowerCase(),
  ]);
  arr.sort(cmpMolValUnit);
  return arr;
}
const sigKey = (sig) => sig.map(([m, v, u]) => `${m}:${v === null ? '' : v}:${u}`).join('|');
const sigIngredients = (sig) => sig.map(([m, v, u]) => ({ molecule: m, strength_value: v, strength_unit: u }));

function vmultiKey(sig) {
  const arr = sig.map(([, v, u]) => [null, v, u]);
  arr.sort((a, b) => {
    const an = a[1] === null; const bn = b[1] === null;
    if (an !== bn) return an ? 1 : -1;
    if ((a[1] ?? 0) !== (b[1] ?? 0)) return (a[1] ?? 0) - (b[1] ?? 0);
    return a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0;
  });
  return arr.map(([, v, u]) => `${v === null ? '' : v}:${u}`).join('|');
}

export function packNum(pl) {
  const m = String(pl ?? '').match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

const compStr = (sig) => sig.map(([m, rv, u]) => (rv === null ? m : `${m} ${fmt(rv)}${u}`.trim())).join(' + ');
const compDisplay = (ings) => ings.map((i) => {
  const molecule = title(i?.molecule ?? '');
  return i?.strength_raw ? `${molecule} ${i.strength_raw}`.trim() : molecule;
}).join(' + ');
const title = (s) => String(s ?? '').replace(/\b([a-z])/g, (c) => c.toUpperCase());

function pickDisplay(names, stoks) {
  const score = (n) => {
    let s = 0; const low = n.toLowerCase();
    if (/strip of|in strip|bottle of|in a strip|vial of|tube of| of /.test(low)) s += 100;
    if (/\b(strip|bottle|vial|sachet|packet|tube)\b/.test(low)) s += 20;
    if (n === n.toUpperCase() && n !== n.toLowerCase()) s += 40; // isupper (has a cased char)
    if (stoks.size) for (const t of stoks) if (!low.includes(t)) s += 30;
    return s + n.length / 500;
  };
  let best = names[0]; let bestScore = score(names[0]);
  for (const n of names) { const sc = score(n); if (sc < bestScore) { best = n; bestScore = sc; } }
  return best;
}

function pickMaker(makers) {
  const counts = new Map();
  for (const m of makers) if (m) counts.set(m, (counts.get(m) ?? 0) + 1);
  let best = null; let bestKey = null;
  for (const [m, c] of counts) {
    const notUpper = !(m === m.toUpperCase() && m !== m.toLowerCase());
    const key = [c, notUpper ? 1 : 0, m.length];
    if (!bestKey || key[0] > bestKey[0] || (key[0] === bestKey[0] && (key[1] > bestKey[1]
      || (key[1] === bestKey[1] && key[2] > bestKey[2])))) { best = m; bestKey = key; }
  }
  return best;
}

const strengthTokens = (ings) => new Set(ings.filter((i) => isNum(i?.strength_value)).map((i) => fmt(i.strength_value)));

function bestIngs(rows) {
  return [...rows].sort((a, b) => {
    const ra = SRC_PREF[a.source] ?? 9; const rb = SRC_PREF[b.source] ?? 9;
    if (ra !== rb) return ra - rb;
    const ca = a.ings.filter((i) => i?.strength_raw).length;
    const cb = b.ings.filter((i) => i?.strength_raw).length;
    return cb - ca;
  })[0].ings;
}

const medId = (bc, form, release, sig) => crypto.createHash('sha1').update(`${bc}|${form}|${release}|${sigKey(sig)}`).digest('hex').slice(0, 12);

export function buildPrescribable(rows, model) {
  // ---------- PASS 1: conflict groups ----------
  const groups = new Map(); // ckKey -> { bc, form, names[], pack, sample, sigs: Map<sigKey,{sig,sources:Set}> }
  for (const r of rows) {
    const ings = r?.ingredients ?? [];
    const sig = sigOf(ings);
    const names = [...new Set(sig.map(([m]) => m).filter(Boolean))].sort();
    if (!names.length) continue;
    const bc = brandCore(r.brand_name);
    const form = normForm(r.brand_name, r.form_raw, r.pack_label);
    const release = releaseProfile(r.brand_name, r.form_raw, r.pack_label);
    const pack = packNum(r.pack_label);
    const ckKey = [bc, form, release, names.join(','), pack].join(SEP);
    let g = groups.get(ckKey);
    if (!g) { g = { bc, form, release, names, pack, sample: r.brand_name, sigs: new Map() }; groups.set(ckKey, g); }
    const sk = sigKey(sig);
    let entry = g.sigs.get(sk);
    if (!entry) { entry = { sig, sources: new Set() }; g.sigs.set(sk, entry); }
    entry.sources.add(((r.sources ?? [{}])[0]).source);
  }

  // ---------- resolve conflicts ----------
  const resolution = new Map(); // ckKey -> { swap, cons(sig), consMap: Map<mol,[v,u]>, review }
  const reviewRows = []; const conflictRows = [];
  for (const [ckKey, g] of groups) {
    const sigEntries = [...g.sigs.values()];
    const allSources = new Set(); for (const e of sigEntries) for (const s of e.sources) allSources.add(s);
    if (allSources.size < 2 || sigEntries.length < 2) continue;
    // every source carrying the same set of sigs is not a real disagreement
    const perSrc = new Map();
    for (const e of sigEntries) for (const s of e.sources) { const set = perSrc.get(s) ?? new Set(); set.add(sigKey(e.sig)); perSrc.set(s, set); }
    const distinctSetKeys = new Set([...perSrc.values()].map((set) => [...set].sort().join('~')));
    if (distinctSetKeys.size < 2) continue;

    const sigs = sigEntries.map((e) => e.sig);
    const isSwap = g.names.length >= 2 && new Set(sigs.map(vmultiKey)).size === 1;
    let cons = sigs[0]; let consScore = model.plausScore(sigIngredients(cons));
    for (const s of sigs) { const sc = model.plausScore(sigIngredients(s)); if (sc > consScore) { cons = s; consScore = sc; } }
    const anyPlausible = sigs.some((s) => s.every(([m, v, u]) => model.isPlausible(m, v, u)));
    const review = !isSwap && !anyPlausible;
    const consMap = new Map(cons.map(([m, v, u]) => [m, [v, u]]));
    resolution.set(ckKey, { swap: isSwap, cons, consMap, review });

    const bySig = (e) => `${compStr(e.sig)} [${[...e.sources].sort().join(',')}]`;
    if (review) {
      reviewRows.push({ brand_sample: g.sample, molecules: g.names.join(' + '), form: g.form, pack: g.pack ?? '',
        n_sources: allSources.size, competing_strengths: sigEntries.map(bySig).join(' ; ') });
    }
    conflictRows.push({ _rank: (isSwap ? 0 : 1) * 1e9 - allSources.size,
      conflict_type: isSwap ? 'swap' : 'value/scale', resolution: `plausibility->${compStr(cons)}`,
      brand_sample: g.sample, molecules: g.names.join(' + '),
      consensus_sources: [...(g.sigs.get(sigKey(cons))?.sources ?? [])].sort().join(','),
      rejected: sigEntries.filter((e) => sigKey(e.sig) !== sigKey(cons)).map(bySig).join(' ; ') });
  }
  conflictRows.sort((a, b) => a._rank - b._rank).forEach((r) => delete r._rank);
  reviewRows.sort((a, b) => b.n_sources - a.n_sources);

  // ---------- PASS 2: merge with repair ----------
  const presc = new Map(); // pkeyKey -> { bc, form, sig, rows[] }
  const resolvedFlag = new Set(); const reviewFlag = new Set();
  for (const r of rows) {
    const ings = (r?.ingredients ?? []).map((i) => ({ ...i }));
    const form = normForm(r.brand_name, r.form_raw, r.pack_label);
    const bc = brandCore(r.brand_name);
    const release = releaseProfile(r.brand_name, r.form_raw, r.pack_label);
    // NB: unlike pass 1 (conflict detection), pass 2 keeps empty-molecule records —
    // they survive as no_strength medicines (matches the reference prototype).
    const names = [...new Set(ings.map((i) => String(i?.molecule ?? '').toLowerCase().trim()).filter(Boolean))].sort();
    const pack = packNum(r.pack_label);
    const ckKey = [bc, form, release, names.join(','), pack].join(SEP);
    const res = resolution.get(ckKey);
    let sig = sigOf(ings);
    if (res && res.swap && sigKey(sig) !== sigKey(res.cons)) {
      for (const i of ings) {
        const m = String(i?.molecule ?? '').toLowerCase().trim();
        if (res.consMap.has(m)) {
          const [v, u] = res.consMap.get(m);
          i.strength_value = v; i.strength_unit = u; i.strength_raw = v === null ? null : `${fmt(v)}${u}`;
        }
      }
      sig = res.cons;
    }
    const source = (r.sources ?? [{}])[0];
    const pkeyKey = [bc, form, release, sigKey(sig)].join(SEP);
    let p = presc.get(pkeyKey);
    if (!p) { p = { bc, form, release, sig, rows: [] }; presc.set(pkeyKey, p); }
    p.rows.push({ brand: r.brand_name, maker: r.manufacturer, type: r.type, form, pack: r.pack_label,
      price: r.price_inr, disc: r.is_discontinued, atc: r.atc_codes ?? [], ings,
      source: source.source, source_id: source.source_id, seen: source.seen_at,
      first: r.first_seen, last: r.last_seen });
    if (res && res.swap) resolvedFlag.add(pkeyKey);
    if (res && res.review) reviewFlag.add(pkeyKey);
  }

  const records = []; const statusCounts = new Map();
  for (const [pkeyKey, p] of presc) {
    const grp = p.rows;
    const ings = bestIngs(grp);
    const names = grp.map((x) => x.brand).filter(Boolean);
    const dv = grp.map((x) => x.disc);
    const disc = dv.some((v) => v === false) ? false : (dv.some((v) => v === true) ? true : null);
    const prices = grp.map((x) => x.price).filter((v) => isNum(v));
    const sources = [...new Set(grp.map((x) => x.source).filter(Boolean))].sort();
    const seenPv = new Set(); const pvs = [];
    for (const x of grp) {
      const s = `${x.source}${SEP}${x.source_id}${SEP}${x.pack}`;
      if (seenPv.has(s)) continue; seenPv.add(s);
      pvs.push({ pack_label: x.pack, price_inr: x.price, source: x.source, source_id: x.source_id, seen_at: x.seen });
    }
    const types = grp.map((x) => x.type).filter(Boolean);
    const molecules = ings.map((i) => ({ molecule: i?.molecule, strength_value: i?.strength_value,
      strength_unit: i?.strength_unit, strength_raw: i?.strength_raw }));

    const haveStrength = molecules.some((m) => m.strength_value !== null && m.strength_value !== undefined);
    let status;
    if (!haveStrength) status = 'no_strength';
    else if (resolvedFlag.has(pkeyKey)) status = 'resolved_by_plausibility';
    else if (sources.length >= 2) status = 'verified';
    else if (molecules.length === 1) {
      const m = molecules[0];
      status = model.isPlausible(String(m.molecule ?? '').toLowerCase(), m.strength_value, String(m.strength_unit ?? '').toLowerCase()) ? 'verified' : 'unverified';
    } else status = model.assignmentUnambiguous(molecules) ? 'verified' : 'unverified';

    let note = null;
    if (status === 'unverified') {
      note = 'strength unverified (single source, ambiguous assignment) — confirm before clinical use';
      for (const m of molecules) { m.strength_value = null; m.strength_unit = null; m.strength_raw = null; } // OPTION B
    } else if (status === 'resolved_by_plausibility') {
      note = 'strength assignment auto-resolved by pharmacological plausibility — verify';
    }
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
    const conflict = reviewFlag.has(pkeyKey);

    records.push({
      med_id: medId(p.bc, p.form, p.release, p.sig),
      display_name: names.length ? pickDisplay(names, strengthTokens(ings)) : null,
      form: p.form, release_profile: p.release, molecules,
      composition_display: status === 'unverified' ? molecules.map((m) => title(m.molecule ?? '')).join(' + ') : compDisplay(ings),
      manufacturer: pickMaker(grp.map((x) => x.maker)),
      brand_aliases: [...new Set(names)].sort(),
      type: types.includes('allopathy') ? 'allopathy' : (types[0] ?? null),
      atc_codes: [...new Set(grp.flatMap((x) => x.atc))].sort(),
      is_discontinued: disc,
      strength_status: status,
      strength_verified: status === 'verified' || status === 'resolved_by_plausibility',
      strength_conflict: conflict,
      strength_note: conflict ? (note ?? 'sources disagree on strength & plausibility cannot decide — needs authoritative review') : note,
      source_count: sources.length, sources,
      price_inr_min: prices.length ? Math.min(...prices) : null,
      price_inr_max: prices.length ? Math.max(...prices) : null,
      pack_count: pvs.length, pack_variants: pvs,
      first_seen: grp.map((x) => x.first).filter(Boolean).sort()[0] ?? null,
      last_seen: grp.map((x) => x.last).filter(Boolean).sort().at(-1) ?? null,
    });
  }
  records.sort((a, b) => (a.display_name ?? '').toLowerCase() < (b.display_name ?? '').toLowerCase() ? -1
    : (a.display_name ?? '').toLowerCase() > (b.display_name ?? '').toLowerCase() ? 1 : 0);

  // Substitution: group verified records by brand-independent formulation_key and
  // annotate each with its same-formulation alternatives (other companies' brands).
  const subGroups = assignSubstituteGroups(records);
  const groupRows = formulationGroupRows(records, subGroups);

  return { records, reviewRows, conflictRows, groupRows, stats: Object.fromEntries(statusCounts) };
}

async function readJsonl(file) {
  const rows = [];
  const lines = readline.createInterface({
    input: fs.createReadStream(file, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    if (line.trim()) rows.push(JSON.parse(line));
  }
  return rows;
}

export async function main(log = console.log, options = {}) {
  const selectedOutput = options.outputDir ?? process.env.AUSHADHI_COHORT_DIR;
  if (typeof selectedOutput !== 'string' || selectedOutput.trim() === '') {
    throw new Error('AUSHADHI_COHORT_DIR is required for a mutable cohort stage');
  }
  const dir = path.resolve(selectedOutput);
  if (fs.existsSync(path.join(dir, 'cohort-manifest.json'))) {
    throw new Error(`manifest-bound cohort is immutable: ${dir}`);
  }
  const src = path.join(dir, 'drugs.jsonl');
  const rows = await readJsonl(src);
  const model = buildStrengthModel(rows);
  const { records, reviewRows, conflictRows, groupRows, stats } = buildPrescribable(rows, model);
  await writeJsonlStream(path.join(dir, 'prescribable.jsonl'), records);
  await writeJsonlStream(path.join(dir, 'formulation_groups.jsonl'), groupRows);
  const reviewFile = path.join(dir, 'strength-review-shortlist.csv');
  const conflictFile = path.join(dir, 'strength-conflicts.csv');
  if (reviewRows.length) {
    await writeCsvStream(reviewFile, reviewRows, { header: true, bom: true, columns: Object.keys(reviewRows[0]) });
  } else {
    fs.rmSync(reviewFile, { force: true });
  }
  if (conflictRows.length) {
    await writeCsvStream(conflictFile, conflictRows, { header: true, bom: true, columns: Object.keys(conflictRows[0]) });
  } else {
    fs.rmSync(conflictFile, { force: true });
  }
  const suppressed = stats.unverified ?? 0;
  const review = records.filter((r) => r.strength_conflict).length;
  const substitutable = records.filter((r) => r.substitute_count > 0).length;
  const multiMemberGroups = groupRows.filter((g) => g.member_count >= 2).length;
  log(`prescribable: ${rows.length} drugs -> ${records.length} medicines`);
  log(`  status: ${JSON.stringify(stats)}`);
  log(`  option-B suppressed: ${suppressed} | review shortlist: ${review}`);
  log(`  substitution: ${substitutable} medicines with alternatives across ${multiMemberGroups} formulation groups -> ${dir}`);
}

const invokedDirectly = process.argv[1]
  && import.meta.url.toLowerCase() === pathToFileURL(path.resolve(process.argv[1])).href.toLowerCase();
if (invokedDirectly) await main();

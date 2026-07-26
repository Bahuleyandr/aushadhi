// Formulation-equivalence for the substitution flow (VH Health). Two prescribable
// medicines are auto-substitutable iff they share a formulation_key: identical
// molecules + VERIFIED strengths + dosage form + release profile.
//
// Release profile is a SAFETY discriminator: immediate-release must never be grouped
// with any modified-release product, and distinct modified-release classes stay apart.
// A suggested substitute is always pharmacist-confirmed, so we prefer to UNDER-group
// (miss a real equivalent) rather than ever propose an unsafe swap.
//
// formulationKey returns null when any strength is missing, so unverified/suppressed
// strengths get NO substitution group automatically — the strength-verification gate
// falls out of the key itself.
import crypto from 'node:crypto';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const round3 = (v) => Math.round(v * 1000) / 1000;

// High-precision detectors: full phrases + only unambiguous abbreviations (word-bounded).
// Ambiguous bare tokens (dr/pr/la/od/ec) are intentionally excluded — tagging a truly
// immediate-release product as modified-release would fragment the (large) IR groups and
// cross-contaminate the MR groups. First match wins; order most-specific-ish first.
const RELEASE_RULES = [
  ['DR', /\b(?:delayed[-\s]?release|enteric[-\s]?coated|gastro[-\s]?resistant)\b/i],
  ['ER', /\b(?:xr|xl|extended[-\s]?release)\b/i],
  ['SR', /\b(?:sr|sustained[-\s]?release)\b/i],
  ['CR', /\b(?:cr|controlled[-\s]?release)\b/i],
  ['MR', /\bmodified[-\s]?release\b/i],
  ['PR', /\bprolonged[-\s]?release\b/i],
  ['LA', /\blong[-\s]?acting\b/i],
  ['RETARD', /\bretard\b/i],
];

// Detect the release profile from any brand/form/pack text. Defaults to 'IR'
// (immediate release) when no modified-release signal is present.
export function releaseProfile(...texts) {
  const text = texts.filter(Boolean).join(' ');
  for (const [label, re] of RELEASE_RULES) if (re.test(text)) return label;
  return 'IR';
}

// Canonical, brand-INDEPENDENT key for a fully-specified formulation. Returns null when
// any molecule lacks a finite strength_value or a molecule name — i.e. unverified /
// suppressed strengths get no substitution key and are never auto-substituted.
export function formulationKey(molecules, form, release) {
  if (!Array.isArray(molecules) || molecules.length === 0) return null;
  const parts = [];
  for (const m of molecules) {
    if (!isNum(m?.strength_value)) return null;
    const mol = String(m?.molecule ?? '').toLowerCase().trim();
    if (!mol) return null;
    parts.push(`${mol}:${round3(m.strength_value)}:${String(m?.strength_unit ?? '').toLowerCase().trim()}`);
  }
  parts.sort();
  return crypto.createHash('sha1')
    .update(`${String(form ?? '')}|${String(release ?? '')}|${parts.join('|')}`)
    .digest('hex').slice(0, 12);
}

// Annotate prescribable records IN PLACE with formulation_key + substitute_count, and
// return the group map (key -> med_id[]). Only strength-verified, non-conflicted records
// with a non-null key participate in substitution.
//
// The full list of a medicine's substitutes is deliberately NOT stored per record: that
// is O(group_size) on EVERY row (quadratic per group) and, for the large common-molecule
// groups, produces gigabytes that overflow the JSON writer. The canonical substitution
// index is formulation_groups.jsonl (each member listed once), joined via formulation_key;
// substitute_count is the cheap per-record signal.
export function assignSubstituteGroups(records) {
  const groups = new Map();
  for (const r of records) {
    const key = (r.strength_verified && !r.strength_conflict)
      ? formulationKey(r.molecules, r.form, r.release_profile)
      : null;
    r.formulation_key = key;
    if (key) {
      const arr = groups.get(key) ?? [];
      arr.push(r.med_id);
      groups.set(key, arr);
    }
  }
  for (const r of records) {
    r.substitute_count = r.formulation_key ? (groups.get(r.formulation_key).length - 1) : 0;
  }
  return groups;
}

// Look up a record's substitutes on demand (other med_ids sharing its formulation_key).
// Provided for programmatic/test use; the persisted index is formulation_groups.jsonl.
export function substitutesFor(record, groups) {
  if (!record?.formulation_key) return [];
  return (groups.get(record.formulation_key) ?? []).filter((id) => id !== record.med_id).sort();
}

// Build formulation_groups export rows (one per group; only groups with >= 2 members are
// substitution-actionable, but singletons are kept so VH can key inventory by formulation).
export function formulationGroupRows(records, groups) {
  const rep = new Map(records.filter((r) => r.formulation_key).map((r) => [r.formulation_key, r]));
  const rows = [];
  for (const [key, medIds] of groups) {
    const r = rep.get(key);
    if (!r) continue;
    rows.push({
      formulation_key: key,
      form: r.form,
      release_profile: r.release_profile,
      molecules: r.molecules.map((m) => ({ molecule: m.molecule, strength_value: m.strength_value, strength_unit: m.strength_unit })),
      member_count: medIds.length,
      member_med_ids: [...medIds].sort(),
    });
  }
  rows.sort((a, b) => b.member_count - a.member_count || (a.formulation_key < b.formulation_key ? -1 : 1));
  return rows;
}

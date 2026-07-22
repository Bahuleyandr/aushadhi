import { normBrandName, normManufacturer, normMolecule, normPack } from './normalize.mjs';

export const SOURCE_PRECEDENCE = ['onemg-live', 'apollo', 'pharmeasy', 'netmeds', 'nppa', 'kaggle-2025', 'janaushadhi', 'github-jr', 'cdsco-fdc'];
const rank = (source) => {
  const index = SOURCE_PRECEDENCE.indexOf(source);
  return index === -1 ? SOURCE_PRECEDENCE.length : index;
};

// Historical SKU-ish key used by source adapters and gapfill targeting.
export function identityKey(row) {
  return [normBrandName(row.brand_name), normManufacturer(row.manufacturer), normPack(row.pack_label)].join('|');
}

function conflictGroupKey(row) {
  return [normBrandName(row.brand_name), normManufacturer(row.manufacturer), normBrandName(row.form_raw)].join('|');
}

export function moleculeSetKey(ingredients = []) {
  return ingredients.map((ingredient) => `${ingredient.molecule}:${ingredient.strength_value ?? ''}${ingredient.strength_unit ?? ''}`).sort().join('|');
}

export function moleculeNameKey(ingredients = []) {
  return [...new Set(ingredients.map((ingredient) => ingredient.molecule))].sort().join('|');
}

const clean = (value) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

function observationIdentity(row) {
  if (row.source) return `${row.source}|${row.source_id ?? ''}`;
  return (row.sources ?? []).map((source) => `${source.source}|${source.source_id ?? ''}`).sort().join(',');
}

const EXACT_STRENGTH_UNIT_RE = /^(?:(?:mg|mcg|µg|ug|g|kg|ml|l|iu|units?|meq|mmol)(?:\/(?:\d+(?:\.\d+)?(?:mg|mcg|µg|ug|g|kg|ml|l|units?)|mg|mcg|µg|ug|g|kg|ml|l|dose|actuation|units?))?|%(?:w\/w|w\/v|v\/v)?)$/i;

export function isExactComposition(ingredients) {
  return Array.isArray(ingredients) && ingredients.length > 0 && ingredients.every((ingredient) => {
    const molecule = normMolecule(ingredient?.molecule ?? '');
    const value = ingredient?.strength_value;
    const unit = String(ingredient?.strength_unit ?? '').replace(/\s+/g, '').toLowerCase();
    return Boolean(molecule)
      && typeof value === 'number'
      && Number.isFinite(value)
      && value > 0
      && EXACT_STRENGTH_UNIT_RE.test(unit);
  });
}

function compositionEvidence(row) {
  const ingredients = row.ingredients ?? [];
  if (!ingredients.length) return { key: 'missing', fullyParsed: false };
  const fullyParsed = isExactComposition(ingredients);
  let unresolvedWithoutRaw = false;
  const parts = ingredients.map((ingredient) => {
    const molecule = clean(ingredient.molecule);
    const unit = clean(ingredient.strength_unit);
    if (fullyParsed) return `${molecule}:parsed:${ingredient.strength_value}:${unit}`;
    const raw = clean(ingredient.strength_raw);
    if (!raw) unresolvedWithoutRaw = true;
    return `${molecule}:unresolved:${raw || '?'}`;
  }).sort();
  const compositionRaw = clean(row.composition_raw);
  let key = parts.join('|');
  if (!fullyParsed) key += `|raw:${compositionRaw}`;
  // Completely unparsed observations are not cross-source equality evidence.
  if (unresolvedWithoutRaw && !compositionRaw) key += `|observation:${observationIdentity(row)}`;
  return { key, fullyParsed };
}

function entityKey(row) {
  const evidence = compositionEvidence(row);
  return [
    normBrandName(row.brand_name), normManufacturer(row.manufacturer),
    normBrandName(row.form_raw), normPack(row.pack_label), evidence.key,
  ].join('|');
}

function conflictEntityKey(row) {
  return [conflictGroupKey(row), compositionEvidence(row).key].join('|');
}

const SIMPLE_DOSAGE_FORMS = new Map([
  ['tablet', 'tablet'], ['tablets', 'tablet'],
  ['capsule', 'capsule'], ['capsules', 'capsule'],
  ['injection', 'injection'], ['injections', 'injection'],
  ['syrup', 'syrup'], ['syrups', 'syrup'],
  ['suspension', 'suspension'], ['suspensions', 'suspension'],
  ['cream', 'cream'], ['creams', 'cream'],
  ['gel', 'gel'], ['gels', 'gel'],
  ['ointment', 'ointment'], ['ointments', 'ointment'],
  ['drop', 'drop'], ['drops', 'drop'],
  ['solution', 'solution'], ['solutions', 'solution'],
  ['lotion', 'lotion'], ['lotions', 'lotion'],
  ['powder', 'powder'], ['powders', 'powder'],
  ['spray', 'spray'], ['sprays', 'spray'],
  ['inhaler', 'inhaler'], ['inhalers', 'inhaler'],
  ['patch', 'patch'], ['patches', 'patch'],
  ['suppository', 'suppository'], ['suppositories', 'suppository'],
  ['granule', 'granule'], ['granules', 'granule'],
  ['emulsion', 'emulsion'], ['emulsions', 'emulsion'],
  ['mouthwash', 'mouthwash'], ['mouthwashes', 'mouthwash'],
  ['lozenge', 'lozenge'], ['lozenges', 'lozenge'],
]);
const TERMINAL_DOSAGE_FORM_RE = new RegExp(`(?:^| )(${[...SIMPLE_DOSAGE_FORMS.keys()].join('|')})$`, 'i');

function explicitDosageForm(row) {
  const supplied = normBrandName(row.form_raw);
  if (supplied) return SIMPLE_DOSAGE_FORMS.get(supplied) ?? supplied;
  const match = normBrandName(row.brand_name).match(TERMINAL_DOSAGE_FORM_RE);
  return match ? SIMPLE_DOSAGE_FORMS.get(match[1].toLowerCase()) : null;
}

function blankAttachKey(row) {
  const evidence = compositionEvidence(row);
  const identity = [
    normBrandName(row.brand_name),
    normManufacturer(row.manufacturer),
    explicitDosageForm(row),
  ];
  if (!evidence.fullyParsed || identity.some((part) => !part)) return null;
  return [...identity, evidence.key].join('|');
}

function sourceRankForOutput(row) {
  return Math.min(...(row.sources ?? []).map((source) => rank(source.source)), SOURCE_PRECEDENCE.length);
}

function dedupeSources(sources) {
  const sourceMap = new Map();
  for (const source of sources) {
    const key = `${source.source}|${source.source_id ?? ''}`;
    const previous = sourceMap.get(key);
    if (!previous || String(source.seen_at ?? '') > String(previous.seen_at ?? '')) sourceMap.set(key, source);
  }
  return [...sourceMap.values()].sort((a, b) => rank(a.source) - rank(b.source)
    || String(a.source_id ?? '').localeCompare(String(b.source_id ?? '')));
}

function finishProvenance(out, sources, observationDates = [], conflict = false) {
  out.sources = dedupeSources(sources);
  out.source_count = new Set(out.sources.map((source) => source.source)).size;
  out.confidence = conflict ? 'conflict' : out.source_count >= 2 ? 'multi_source' : 'single_source';
  const dates = [
    ...observationDates,
    ...out.sources.map((source) => source.seen_at),
  ].filter(Boolean).sort();
  out.first_seen = dates[0] ?? null;
  out.last_seen = dates.at(-1) ?? null;
  return out;
}

function nonempty(value) {
  return value !== null && value !== undefined && value !== '';
}

function mergeRawGroup(group) {
  const ranked = [...group].sort((a, b) => rank(a.source) - rank(b.source)
    || String(b.seen_at ?? '').localeCompare(String(a.seen_at ?? '')));
  const best = ranked[0];
  const out = { ...best };
  for (const field of ['pack_label', 'form_raw', 'price_inr', 'is_discontinued', 'type']) {
    out[field] = ranked.map((row) => row[field]).find(nonempty) ?? null;
  }
  out.ingredients = best.ingredients ?? [];
  out.composition_raw = best.composition_raw ?? null;
  out.composition_status = best.composition_status ?? (out.ingredients.length ? 'complete' : 'missing');
  out.two_slot_maxed = best.two_slot_maxed === true;
  out.substitutes_raw = [...new Map(
    group.flatMap((row) => row.substitutes_raw ?? []).map((substitute) => [normBrandName(substitute.name), substitute]),
  ).values()];
  finishProvenance(
    out,
    group.map((row) => ({ source: row.source, source_id: row.source_id ?? null, seen_at: row.seen_at })),
    group.flatMap((row) => [row.first_seen, row.seen_at]),
  );
  delete out.source;
  delete out.source_id;
  delete out.seen_at;
  return out;
}

function mergeCompiledGroup(group, { packOwner = null } = {}) {
  const ranked = [...group].sort((a, b) => sourceRankForOutput(a) - sourceRankForOutput(b));
  const best = ranked[0];
  const out = { ...best };
  const packRows = packOwner ? [packOwner] : ranked;
  for (const field of ['pack_label', 'price_inr', 'is_discontinued']) {
    out[field] = packRows.map((row) => row[field]).find(nonempty) ?? null;
  }
  for (const field of ['form_raw', 'type']) {
    out[field] = ranked.map((row) => row[field]).find(nonempty) ?? null;
  }
  out.ingredients = best.ingredients ?? [];
  out.composition_raw = best.composition_raw ?? null;
  out.composition_status = best.composition_status ?? (out.ingredients.length ? 'complete' : 'missing');
  out.two_slot_maxed = best.two_slot_maxed === true;
  out.substitutes_raw = [...new Map(
    group.flatMap((row) => row.substitutes_raw ?? []).map((substitute) => [normBrandName(substitute.name), substitute]),
  ).values()];
  const dates = group.flatMap((row) => [row.first_seen, row.last_seen]);
  return finishProvenance(
    out,
    group.flatMap((row) => row.sources ?? []),
    dates,
    group.some((row) => row.confidence === 'conflict'),
  );
}

function reconcileBlankPacks(rows) {
  const groups = new Map();
  const passthrough = [];
  for (const row of rows) {
    const key = blankAttachKey(row);
    if (!key) { passthrough.push(row); continue; }
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  const output = [...passthrough];
  for (const group of groups.values()) {
    const known = group.filter((row) => normPack(row.pack_label));
    const blank = group.filter((row) => !normPack(row.pack_label));
    if (known.length === 1 && blank.length) output.push(mergeCompiledGroup([known[0], ...blank], { packOwner: known[0] }));
    else output.push(...group);
  }
  return output;
}

export function coalesceExactDuplicates(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = entityKey(row);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  const exact = [...groups.values()].map((group) => group.length > 1 ? mergeCompiledGroup(group) : group[0]);
  return reconcileBlankPacks(exact);
}

function rowEvidence(row) {
  const identity = identityKey(row);
  const entity = entityKey(row);
  const sources = Array.isArray(row.sources) && row.sources.length ? row.sources : [row];
  return sources.map((source) => ({
    source: source.source ?? row.source ?? null,
    source_id: source.source_id ?? row.source_id ?? null,
    seen_at: source.seen_at ?? row.seen_at ?? null,
    first_seen: source.first_seen ?? row.first_seen ?? null,
    pack_label: row.pack_label ?? null,
    form_raw: row.form_raw ?? null,
    identity_key: identity,
    entity_key: entity,
  }));
}

function evidenceForRows(rows) {
  const byKey = new Map();
  for (const row of rows) {
    for (const item of rowEvidence(row)) {
      const key = JSON.stringify([
        item.entity_key, item.identity_key, item.source, item.source_id, item.seen_at,
        item.first_seen, item.pack_label, item.form_raw,
      ]);
      byKey.set(key, item);
    }
  }
  return [...byKey.values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function conflictSide(key, rows, extra = {}) {
  const evidence = evidenceForRows(rows);
  return { key, ...(evidence[0] ?? {}), evidence, ...extra };
}

function detectCompositionConflicts(allRows) {
  const groups = new Map();
  for (const row of allRows) {
    if (!(row.ingredients ?? []).length) continue;
    const key = conflictGroupKey(row);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  const conflicts = [];
  const affectedEntityKeys = new Set();
  for (const [identity, group] of groups) {
    const byComposition = new Map();
    for (const row of group) {
      const key = compositionEvidence(row).key;
      const rows = byComposition.get(key) ?? [];
      rows.push(row);
      byComposition.set(key, rows);
    }
    const compositions = [...byComposition.entries()];
    for (let i = 0; i < compositions.length; i++) {
      for (let j = i + 1; j < compositions.length; j++) {
        const [keyA, rowsA] = compositions[i];
        const [keyB, rowsB] = compositions[j];
        const a = rowsA[0]; const b = rowsB[0];
        const kind = moleculeNameKey(a.ingredients) === moleculeNameKey(b.ingredients)
          ? 'strength_disagreement' : 'composition_disagreement';
        const affectedRows = [...rowsA, ...rowsB];
        const affectedIdentityKeys = [...new Set(affectedRows.map((row) => identityKey(row)))].sort();
        const affectedCompositionEntityKeys = [...new Set(affectedRows.map((row) => entityKey(row)))].sort();
        conflicts.push({
          kind,
          identity_key: identity,
          affected_identity_keys: affectedIdentityKeys,
          affected_entity_keys: affectedCompositionEntityKeys,
          a: conflictSide(keyA, rowsA),
          b: conflictSide(keyB, rowsB),
        });
        for (const row of affectedRows) affectedEntityKeys.add(conflictEntityKey(row));
      }
    }
  }
  return { conflicts, affectedEntityKeys };
}

// Cross-validation: a 1mg-substitute pair should share the same molecule-name set.
// A substitute name that maps to multiple entities is itself a conflict: choosing
// one candidate would make the result dependent on row order.
export function detectSubstituteMismatches(rows) {
  const byBrand = new Map();
  for (const row of rows) {
    const key = normBrandName(row.brand_name);
    if (!key) continue;
    const variants = byBrand.get(key) ?? [];
    variants.push(row);
    byBrand.set(key, variants);
  }
  const conflicts = [];
  const emitted = new Set();
  for (const row of rows) {
    if (!row.ingredients?.length || !(row.substitutes_raw ?? []).length) continue;
    for (const substitute of row.substitutes_raw) {
      const sourceEntityKey = entityKey(row);
      const candidates = (byBrand.get(normBrandName(substitute.name)) ?? [])
        .filter((candidate) => entityKey(candidate) !== sourceEntityKey);
      const byEntity = new Map();
      for (const candidate of candidates) {
        const key = entityKey(candidate);
        const group = byEntity.get(key) ?? [];
        group.push(candidate);
        byEntity.set(key, group);
      }
      const variantGroups = [...byEntity.entries()];
      if (!variantGroups.length) continue;
      const candidateRows = variantGroups.flatMap(([, group]) => group);
      const affected = [row, ...candidateRows];
      const affectedIdentityKeys = [...new Set(affected.map((item) => identityKey(item)))].sort();
      const affectedCompositionEntityKeys = [...new Set(affected.map((item) => entityKey(item)))].sort();
      if (variantGroups.length > 1) {
        const signature = `ambiguous|${sourceEntityKey}|${affectedCompositionEntityKeys.join(',')}`;
        if (emitted.has(signature)) continue;
        emitted.add(signature);
        conflicts.push({
          kind: 'substitute_target_ambiguous',
          identity_key: identityKey(row),
          affected_identity_keys: affectedIdentityKeys,
          affected_entity_keys: affectedCompositionEntityKeys,
          a: conflictSide(moleculeNameKey(row.ingredients), [row], { brand: row.brand_name }),
          b: conflictSide('ambiguous', candidateRows, {
            brand: substitute.name,
            candidate_composition_keys: [...new Set(candidateRows.map((candidate) => compositionEvidence(candidate).key))].sort(),
          }),
        });
        continue;
      }
      const [, otherRows] = variantGroups[0];
      const other = otherRows[0];
      if (!other.ingredients?.length) continue;
      const left = moleculeNameKey(row.ingredients);
      const right = moleculeNameKey(other.ingredients);
      if (left === right) continue;
      const signature = `mismatch|${affectedCompositionEntityKeys.join(',')}`;
      if (emitted.has(signature)) continue;
      emitted.add(signature);
      conflicts.push({
        kind: 'substitute_group_mismatch',
        identity_key: identityKey(row),
        affected_identity_keys: affectedIdentityKeys,
        affected_entity_keys: affectedCompositionEntityKeys,
        a: conflictSide(left, [row], { brand: row.brand_name }),
        b: conflictSide(right, otherRows, { brand: other.brand_name }),
      });
    }
  }
  return conflicts;
}

const isFiniteNum = (value) => typeof value === 'number' && Number.isFinite(value);

// Annotate each merged row with a plausibility-based strength verification status.
// This is resolution-free: strengths are NOT altered or suppressed here (that is the
// prescribable/clinical layer's job) — every consumer just gets a trust signal:
//   strength_verified: safe to auto-fill? (>=2 sources agree | single-molecule &
//     plausible | single-source combo whose molecule->strength assignment is
//     plausibility-unambiguous).
//   strength_status:   verified | unverified | no_strength.
//   strength_conflict: sources give the SAME product two different strengths
//     (a strength_disagreement conflict) — flag for review.
function annotateStrengthVerification(rows, model, conflicts) {
  const disagreementEntityKeys = new Set();
  for (const conflict of conflicts) {
    if (conflict.kind !== 'strength_disagreement') continue;
    for (const key of conflict.affected_entity_keys ?? []) disagreementEntityKeys.add(key);
  }
  for (const row of rows) {
    const ingredients = row.ingredients ?? [];
    const hasStrength = ingredients.some((ingredient) => isFiniteNum(ingredient?.strength_value));
    if (!hasStrength) {
      row.strength_status = 'no_strength';
      row.strength_verified = false;
      row.strength_conflict = false;
      continue;
    }
    if ((row.source_count ?? 1) >= 2) {
      row.strength_status = 'verified';
      row.strength_verified = true;
    } else if (ingredients.length === 1) {
      const ok = model.isPlausible(ingredients[0].molecule, ingredients[0].strength_value, ingredients[0].strength_unit);
      row.strength_status = ok ? 'verified' : 'unverified';
      row.strength_verified = ok;
    } else {
      const ok = model.assignmentUnambiguous(ingredients);
      row.strength_status = ok ? 'verified' : 'unverified';
      row.strength_verified = ok;
    }
    row.strength_conflict = disagreementEntityKeys.has(entityKey(row));
  }
  return rows;
}

export function mergeRows(allRows, { model = null } = {}) {
  const entityGroups = new Map();
  for (const row of allRows) {
    const key = entityKey(row);
    const group = entityGroups.get(key) ?? [];
    group.push(row);
    entityGroups.set(key, group);
  }
  const { conflicts, affectedEntityKeys } = detectCompositionConflicts(allRows);
  let rows = [...entityGroups.values()].map(mergeRawGroup);
  rows = reconcileBlankPacks(rows);
  for (const row of rows) {
    if (affectedEntityKeys.has(conflictEntityKey(row))) row.confidence = 'conflict';
  }
  if (model) annotateStrengthVerification(rows, model, conflicts);
  return { rows, conflicts };
}

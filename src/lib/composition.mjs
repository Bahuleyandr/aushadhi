import { normMolecule } from './normalize.mjs';

const STRENGTH_RE = /\(([^()]*)\)\s*$/;
const VALUE_UNIT_RE = /^([\d.]+)\s*([a-zµ%][a-zµ%\/\d.\s]*)$/i;

export function parseIngredient(part) {
  const raw = (part ?? '').toString().trim();
  if (!raw || /^(na|n\/a|-|none)$/i.test(raw)) return null;
  let moleculeRaw = raw;
  let strength_raw = null;
  const m = raw.match(STRENGTH_RE);
  if (m) {
    moleculeRaw = raw.slice(0, m.index).trim();
    strength_raw = m[1].trim() || null;
  }
  const molecule = normMolecule(moleculeRaw);
  if (!molecule) return null;
  let strength_value = null;
  let strength_unit = null;
  if (strength_raw) {
    const vu = strength_raw.match(VALUE_UNIT_RE);
    if (vu) {
      strength_value = Number(vu[1]);
      strength_unit = vu[2].replace(/\s+/g, '').toLowerCase();
    }
  }
  return { molecule, strength_value, strength_unit, strength_raw };
}

export function splitCompositionString(s) {
  const t = (s ?? '').toString().trim();
  if (!t) return [];
  return t.split(/\s*\+\s*/).map((x) => x.trim()).filter(Boolean);
}

export function parseComposition(parts) {
  const list = Array.isArray(parts) ? parts : splitCompositionString(parts);
  const ingredients = [];
  for (const p of list) {
    const ing = parseIngredient(p);
    if (ing) ingredients.push(ing);
  }
  ingredients.sort((a, b) => a.molecule.localeCompare(b.molecule));
  const raw = list.map((s) => (s ?? '').toString().trim()).filter(Boolean).join(' + ');
  return { ingredients, status: ingredients.length ? 'complete' : 'missing', raw };
}

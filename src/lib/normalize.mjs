const WS = /\s+/g;

export function normText(s) {
  return (s ?? '').toString().toLowerCase()
    .replace(/[‘’'"`]/g, '')
    .replace(WS, ' ').trim();
}

export function normBrandName(s) {
  return normText(s);
}

const MFR_SUFFIXES = /\b(private|pvt|ltd|limited|pharmaceuticals?|pharma|laboratories|labs|healthcare|lifesciences|life sciences|india|industries|inc|co)\b\.?/g;

export function normManufacturer(s) {
  const base = normText(s).replace(/[.,&]/g, ' ');
  const t = base.replace(MFR_SUFFIXES, ' ').replace(WS, ' ').trim();
  return t || base.replace(WS, ' ').trim();
}

export function normPack(s) {
  return normText(s).replace(/[^a-z0-9 ]/g, ' ').replace(WS, ' ').trim();
}

// Spelling/salt-name variants ONLY (no therapeutic equivalence). Grows via reviewed additions.
export const MOLECULE_ALIASES = new Map([
  ['amoxicillin', 'amoxycillin'],
  ['acetaminophen', 'paracetamol'],
  ['clavulanate', 'clavulanic acid'],
  ['clavulanate potassium', 'clavulanic acid'],
  ['potassium clavulanate', 'clavulanic acid'],
  ['vitamin d3', 'cholecalciferol'],
  ['cetirizine hydrochloride', 'cetirizine'],
  ['metformin hydrochloride', 'metformin'],
]);

export function normMolecule(s) {
  const t = normText(s).replace(/[()]/g, '').trim();
  return MOLECULE_ALIASES.get(t) ?? t;
}

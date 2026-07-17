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
// The spelling/format group below was derived from a near-duplicate cluster scan
// over the live ~2,800-molecule vocabulary (2026-07-17): British/American and
// Indian-market spelling variants, space/hyphen splits, and vitamin-name compounds
// that were fragmenting the same molecule across several identity strings.
export const MOLECULE_ALIASES = new Map([
  ['amoxicillin', 'amoxycillin'],
  ['acetaminophen', 'paracetamol'],
  ['clavulanate', 'clavulanic acid'],
  ['clavulanate potassium', 'clavulanic acid'],
  ['potassium clavulanate', 'clavulanic acid'],
  ['vitamin d3', 'cholecalciferol'],
  ['cetirizine hydrochloride', 'cetirizine'],
  ['metformin hydrochloride', 'metformin'],
  // ph/f + ceph/cef + -um misspellings + oe/e
  ['guaiphenesin', 'guaifenesin'],
  ['tazobactum', 'tazobactam'],
  ['sulbactum', 'sulbactam'],
  ['cephalexin', 'cefalexin'],
  ['cephadroxil', 'cefadroxil'],
  ['sulphadoxine', 'sulfadoxine'],
  ['sulphacetamide', 'sulfacetamide'],
  ['etophylline', 'etofylline'],
  ['frusemide', 'furosemide'],
  ['beclomethasone', 'beclometasone'],
  ['clomiphene', 'clomifene'],
  // space / hyphen splits of a single molecule
  ['methyl prednisolone', 'methylprednisolone'],
  ['methyl ergometrine', 'methylergometrine'],
  ['levo-carnitine', 'levocarnitine'],
  ['ethinyl estradiol', 'ethinylestradiol'],
  ['povidone-iodine', 'povidone iodine'],
  ['sodium picosulphate', 'sodium picosulfate'],
  ['silver sulphadiazine', 'silver sulfadiazine'],
  // vitamin-number + chemical-name compounds -> the chemical name
  ['vitamin b6 pyridoxine', 'pyridoxine'],
  ['vitamin b1 thiamine', 'thiamine'],
  ['thiamine vitamin b1', 'thiamine'],
  ['thiaminevitamin b1', 'thiamine'],
  ['vitamin b12 methylcobalamin', 'methylcobalamin'],
  ['vitamin b3 niacinamide', 'niacinamide'],
]);

// Trailing SALT suffixes only (therapeutically-equivalent forms) — never esters
// (propionate/valerate/furoate change potency class) and never chloride/bromide/
// iodide (integral to molecules like sodium chloride, ipratropium bromide).
const SALT_SUFFIXES = new Set([
  'hydrochloride', 'dihydrochloride', 'hcl', 'sodium', 'potassium', 'calcium',
  'magnesium', 'sulphate', 'sulfate', 'maleate', 'tartrate', 'bitartrate',
  'mesylate', 'besylate', 'besilate', 'tosylate', 'citrate', 'phosphate',
  'hydrobromide', 'succinate', 'fumarate', 'oxalate', 'nitrate',
  'monohydrate', 'dihydrate', 'trihydrate', 'anhydrous', 'ip', 'bp', 'usp',
]);

export function normMolecule(s) {
  // strip parens, then leading/trailing punctuation artifacts ("menthol -",
  // "niacinamide-", "- arteether") while preserving internal hyphens/digits
  // (co-trimoxazole, vitamin k2-7, s-amlodipine)
  const t = normText(s).replace(/[()]/g, '').replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '').replace(WS, ' ').trim();
  const aliased = MOLECULE_ALIASES.get(t);
  if (aliased) return aliased;
  const words = t.split(' ');
  while (words.length >= 2 && SALT_SUFFIXES.has(words.at(-1)) && !SALT_SUFFIXES.has(words[0])) {
    words.pop();
  }
  const stripped = words.join(' ');
  return (stripped.length >= 3 ? MOLECULE_ALIASES.get(stripped) ?? stripped : t);
}

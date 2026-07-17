import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normText, normBrandName, normManufacturer, normPack, normMolecule } from '../src/lib/normalize.mjs';

test('normText lowercases, collapses ws, strips quotes', () => {
  assert.equal(normText('  Augmentin  625 DUO   Tablet '), 'augmentin 625 duo tablet');
  assert.equal(normText("D'Cold Total"), 'dcold total');
  assert.equal(normText(null), '');
});

test('normBrandName is normText', () => {
  assert.equal(normBrandName('Azithral 500 Tablet'), 'azithral 500 tablet');
});

test('normManufacturer drops corporate suffixes but never returns empty', () => {
  assert.equal(
    normManufacturer('GlaxoSmithKline Pharmaceuticals Ltd'),
    normManufacturer('Glaxosmithkline Pharmaceuticals Ltd.'),
  );
  assert.equal(normManufacturer('Mankind Pharma Ltd'), 'mankind');
  assert.notEqual(normManufacturer('Pharma Ltd'), '');
});

test('normPack strips punctuation', () => {
  assert.equal(normPack('strip of 10 tablets'), normPack('Strip of 10  Tablets.'));
});

test('normMolecule strips trailing salt suffixes, never esters or halides', () => {
  assert.equal(normMolecule('Diclofenac Sodium'), 'diclofenac');
  assert.equal(normMolecule('Ondansetron Hydrochloride'), 'ondansetron');
  assert.equal(normMolecule('Atorvastatin Calcium'), 'atorvastatin');
  assert.equal(normMolecule('Metformin Hydrochloride IP'), 'metformin');
  assert.equal(normMolecule('Sodium Chloride'), 'sodium chloride');       // halide integral
  assert.equal(normMolecule('Magnesium Sulphate'), 'magnesium sulphate'); // salt-word head guard
  assert.equal(normMolecule('Fluticasone Propionate'), 'fluticasone propionate'); // ester = potency class
});

test('normMolecule applies alias map', () => {
  assert.equal(normMolecule('Amoxicillin'), 'amoxycillin');
  assert.equal(normMolecule('Acetaminophen'), 'paracetamol');
  assert.equal(normMolecule('Clavulanate Potassium'), 'clavulanic acid');
  assert.equal(normMolecule('Dolo-molecule-unknown'), 'dolo-molecule-unknown');
});

test('normMolecule strips leading/trailing punctuation artifacts, keeps internal', () => {
  assert.equal(normMolecule('Menthol -'), 'menthol');
  assert.equal(normMolecule('Niacinamide-'), 'niacinamide');
  assert.equal(normMolecule('- Arteether'), 'arteether');
  assert.equal(normMolecule('Co-Trimoxazole'), 'co-trimoxazole'); // internal hyphen preserved
  assert.equal(normMolecule('Vitamin K2-7'), 'vitamin k2-7');     // internal digit-hyphen preserved
});

test('normMolecule canonicalizes spelling and format variants', () => {
  assert.equal(normMolecule('Guaiphenesin'), 'guaifenesin');       // ph spelling
  assert.equal(normMolecule('Tazobactum'), 'tazobactam');          // -um misspelling
  assert.equal(normMolecule('Cephalexin'), 'cefalexin');           // ceph->cef
  assert.equal(normMolecule('Sulphadoxine'), 'sulfadoxine');       // sulph->sulf
  assert.equal(normMolecule('Methyl Prednisolone'), 'methylprednisolone'); // space split
  assert.equal(normMolecule('Levo-Carnitine'), 'levocarnitine');   // hyphen split
  assert.equal(normMolecule('Vitamin B6 Pyridoxine'), 'pyridoxine'); // vitamin-name compound
  assert.equal(normMolecule('Sodium Picosulphate'), 'sodium picosulfate');
});

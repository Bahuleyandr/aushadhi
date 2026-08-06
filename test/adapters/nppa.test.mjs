import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadNppaRows, parseNppaLine, parseNppaText } from '../../src/adapters/nppa.mjs';

const sample = fs.readFileSync('test/fixtures/nppa/sample.txt', 'utf8');

test('parseNppaLine: SL No + NLEM version + formulation + strength + ceiling price', () => {
  const r = parseNppaLine('1  2011  Acetylsalicylic acid  Tablet 300 mg  1582(E)  25-Mar-2026  ¹ 0.28(1 Tablet)');
  assert.match(r.formulation, /Acetylsalicylic acid/i);
  assert.equal(r.strength, '300mg');
  assert.equal(r.ceiling_price, 0.28);
});

test('parseNppaLine: injection in mcg, price with thousands + wrapped unit', () => {
  const r = parseNppaLine('14  2015  Anti-D Immunoglobulin  Injection 300 mcg  1581(E)  25-Mar-2026  ¹ 2721.28(Each Pack)');
  assert.match(r.formulation, /Anti-D Immunoglobulin/i);
  assert.equal(r.strength, '300mcg');
  assert.equal(r.ceiling_price, 2721.28);
});

test('parseNppaLine: header, continuation, device/condom lines -> null', () => {
  assert.equal(parseNppaLine('SL No   NLEM Version          Formulation'), null);
  assert.equal(parseNppaLine('                       te'), null); // wrapped continuation
  assert.equal(parseNppaLine('20  2015  Bare Metal Stents  DEVICE --  1587(E)  25-Mar-2026  ¹ 10762.15(1 Unit)'), null);
  assert.equal(parseNppaLine('3  2011  Condom  CONDOM  1582(E)  25-Mar-2026  ¹ 11.65(1 Condom)'), null);
});

test('parseNppaText: drug rows carry composition + price; devices skipped', async () => {
  const rows = await parseNppaText(sample, '2026-03-25');
  // 7 SL-No rows in the fixture, minus Condom + Bare Metal Stents = 5 drug rows
  assert.equal(rows.length, 5);
  const cefixime = rows.find((r) => r.ingredients.some((i) => i.molecule === 'cefixime'));
  assert.ok(cefixime, 'cefixime row present');
  assert.equal(cefixime.ingredients[0].strength_value, 400);
  assert.equal(cefixime.price_inr, 37.28);
  assert.equal(cefixime.source, 'nppa');
  assert.equal(cefixime.manufacturer, 'NPPA (ceiling price)');
  assert.ok(!rows.some((r) => /condom|stent/i.test(r.brand_name)), 'no device/condom rows');
});

// ── extraction-integrity detection ────────────────────────────────────────
//
// Guards the failure mode that produced the PMBJP false alarm: pdftotext silently
// orphaning table cells, so rows vanish before parsing ever sees them. The SL
// column is the document's own claim about its row count, and rows we drop on
// purpose (devices, continuations) still match the SL pattern, so they do not
// depress the count.
import { nppaExtractionIntegrity } from '../../src/adapters/nppa.mjs';

test('nppaExtractionIntegrity: a complete extraction reports complete', () => {
  const text = [
    '1  2011  Acetylsalicylic acid  Tablet 300 mg  1582(E)  25-Mar-2026  0.28(1 Tablet)',
    '2  2011  Paracetamol  Tablet 500 mg  1582(E)  25-Mar-2026  1.10(1 Tablet)',
    '3  2015  Condom  Device  1582(E)  25-Mar-2026  2.00(1 Piece)',
  ].join('\n');
  const integrity = nppaExtractionIntegrity(text);
  assert.equal(integrity.sl_lines_found, 3);
  assert.equal(integrity.max_sl_number, 3);
  assert.equal(integrity.missing_sl_count, 0);
  assert.equal(integrity.complete, true);
});

test('nppaExtractionIntegrity: rows lost in extraction are detected', () => {
  // the document numbers up to 5 but only 2 SL lines survived extraction
  const text = [
    '1  2011  Acetylsalicylic acid  Tablet 300 mg  1582(E)  25-Mar-2026  0.28(1 Tablet)',
    '5  2011  Zinc sulphate  Tablet 20 mg  1582(E)  25-Mar-2026  1.00(1 Tablet)',
  ].join('\n');
  const integrity = nppaExtractionIntegrity(text);
  assert.equal(integrity.sl_lines_found, 2);
  assert.equal(integrity.max_sl_number, 5);
  assert.equal(integrity.missing_sl_count, 3);
  assert.equal(integrity.complete, false);
});

test('nppaExtractionIntegrity: deliberately dropped device rows do not count as extraction loss', () => {
  // parseNppaLine returns null for the device row, but the SL line is present, so
  // integrity must stay complete - our filtering is not extraction damage
  const text = [
    '1  2011  Acetylsalicylic acid  Tablet 300 mg  1582(E)  25-Mar-2026  0.28(1 Tablet)',
    '2  2015  Condom  Device  1582(E)  25-Mar-2026  2.00(1 Piece)',
  ].join('\n');
  assert.equal(nppaExtractionIntegrity(text).complete, true);
});

test('nppaExtractionIntegrity: empty input is not reported as complete', () => {
  assert.equal(nppaExtractionIntegrity('').complete, false);
  assert.equal(nppaExtractionIntegrity('').max_sl_number, 0);
});

test('NPPA PDF conversion writes only to the derived cache', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nppa-derived-'));
  const dir = path.join(root, 'nppa');
  const derivedRoot = path.join(root, '..', `${path.basename(root)}-derived`);
  fs.mkdirSync(dir, { recursive: true });
  const pdf = path.join(dir, 'ceiling-prices.pdf');
  fs.writeFileSync(pdf, 'stable fake PDF bytes');

  const rows = await loadNppaRows(root, '2026-08-06', {
    derivedRoot,
    pdfToTextImpl: async (_source, target, options) => {
      assert.equal(options.mode, 'layout');
      fs.writeFileSync(
        target,
        '1  2011  Acetylsalicylic acid  Tablet 300 mg  1582(E)  25-Mar-2026  0.28(1 Tablet)\n',
      );
      return { file: target, mode: options.mode };
    },
  });

  assert.equal(rows.length, 1);
  assert.equal(fs.existsSync(path.join(dir, 'ceiling-prices.txt')), false);
  assert.equal(
    fs.readdirSync(path.join(derivedRoot, 'nppa')).filter((name) => name.endsWith('.txt')).length,
    1,
  );
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(derivedRoot, { recursive: true, force: true });
});

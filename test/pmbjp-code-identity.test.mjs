// Regression guards from the F5 investigation.
//
// F5 was raised as a code-identity defect and turned out to be an artifact of
// extracting the PMBJP list with pdftotext -layout, which mis-renders this ruled
// table. The committed codes were correct all along. What these tests pin is the
// machinery that makes that verifiable rather than assumed: an explicit extraction
// mode, an in-document completeness assertion, recorded source provenance, and a
// mapping-code verifier that fails closed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PMBJP_PROVENANCE_FILENAME,
  assertJanAushadhiParseComplete,
  countJanAushadhiSerials,
  janAushadhiParseIntegrity,
  parseJanAushadhiText,
  readJanAushadhiProvenance,
  writeJanAushadhiProvenance,
} from '../src/adapters/janaushadhi.mjs';
import { pdfToText } from '../src/lib/pdftotext.mjs';
import { namesAgree } from '../src/cli/verify-pmbjp-mapping-codes.mjs';

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pmbjp-provenance-'));
}

test('a downloaded PMBJP list records a verifiable source identity', () => {
  const dir = tempDir();
  const pdf = path.join(dir, 'pmbjp.pdf');
  const bytes = Buffer.from('%PDF-1.4 pretend product list');
  fs.writeFileSync(pdf, bytes);

  const provenance = writeJanAushadhiProvenance(dir, {
    origin: 'download',
    sourceUrl: 'https://static.pib.gov.in/example.pdf',
    pdfPath: pdf,
  });

  assert.equal(provenance.origin, 'download');
  assert.equal(provenance.source_url, 'https://static.pib.gov.in/example.pdf');
  assert.equal(provenance.pdf_sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(provenance.pdf_byte_count, bytes.length);
  assert.equal(provenance.code_space_verifiable, true);

  assert.deepEqual(readJanAushadhiProvenance(dir), provenance);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a text-only cache is recorded as an unverifiable code space rather than assumed correct', () => {
  const dir = tempDir();
  const provenance = writeJanAushadhiProvenance(dir, {
    origin: 'cached-text-only',
    sourceUrl: null,
    pdfPath: null,
  });

  // a snapshot whose source PDF is gone cannot have its drug codes re-checked
  // against the document that produced them, so say so rather than imply it was
  assert.equal(provenance.code_space_verifiable, false);
  assert.equal(provenance.pdf_sha256, null);
  assert.equal(provenance.pdf_byte_count, null);
  assert.ok(fs.existsSync(path.join(dir, PMBJP_PROVENANCE_FILENAME)));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('readJanAushadhiProvenance returns null when nothing was recorded', () => {
  const dir = tempDir();
  assert.equal(readJanAushadhiProvenance(dir), null);
  fs.rmSync(dir, { recursive: true, force: true });
});

// ── the parser itself is sound; the defect is source-document identity ──────

test('the PMBJP row parser binds each name to the drug code column, not the serial', () => {
  const rows = parseJanAushadhiText([
    'S. No. Drug      Generic Name of Item                     Unit Size',
    '529 736          Cefuroxime Axetil Tablets IP 125mg       6\'s',
    '530 739          Clarithromycin Tablets IP 250 mg         10\'s',
    '531 740          Cefpodoxime Proxetil Dispersible Tablets 50 mg   10\'s',
  ].join('\n'), '2026-07-27');

  const byCode = new Map(rows.map((row) => [String(row.source_id), row.brand_name]));
  assert.equal(byCode.get('739'), 'Clarithromycin Tablets IP 250 mg');
  assert.equal(byCode.get('740'), 'Cefpodoxime Proxetil Dispersible Tablets 50 mg');
  assert.equal(byCode.get('736'), 'Cefuroxime Axetil Tablets IP 125mg');
  // the serial numbers must never be mistaken for drug codes
  assert.equal(byCode.has('529'), false);
  assert.equal(byCode.has('530'), false);
});

// ── the code verifier must fail closed ─────────────────────────────────────

const { verifyPmbjpMappingCodes } = await import('../src/cli/verify-pmbjp-mapping-codes.mjs');

test('the code verifier rejects a source list whose sha256 does not match', async () => {
  const dir = tempDir();
  const list = path.join(dir, 'list.txt');
  fs.writeFileSync(list, '529 736          Cefuroxime Axetil Tablets IP 125mg       6\'s\n');
  await assert.rejects(
    () => verifyPmbjpMappingCodes({
      listPath: list,
      expectedSha256: '0'.repeat(64),
      cataloguePath: path.join(dir, 'missing.jsonl'),
    }),
    /sha256 mismatch/u,
  );
  fs.rmSync(dir, { recursive: true, force: true });
});

test('every committed mapping code verifies against the official list', () => {
  const record = JSON.parse(fs.readFileSync(
    path.resolve('docs/interaction-review/2026-07-27-pmbjp-code-identity-quarantine.json'),
    'utf8',
  ));
  assert.equal(record.status, 'resolved_false_alarm');
  assert.equal(record.mappings_checked, 17);
  assert.equal(record.confirmed_count, 17);
  assert.equal(record.unconfirmed_count, 0);
  assert.equal(record.blocks_new_pmbjp_mappings, false);
  // the extraction mode is part of the data contract and must stay recorded
  assert.equal(record.verification_run.extraction_mode, 'table');
});

// ── extraction completeness must fail closed ───────────────────────────────
//
// The PMBJP list is a ruled table. Xpdf -layout renders many name cells into a
// separate block, orphaning them from their drug code: 1466 parsed rows against
// 2111 serial-numbered products. -table keeps every name on its own row. A build
// that silently accepted the lossy extraction would mislabel drug codes wholesale,
// so the row count is checked against an in-document ground truth.

const LOSSY_EXTRACT = [
  'S. No. Drug      Generic Name of Item                     Unit Size',
  '1367  2138       Torsemide Tablets IP 100mg               10\'s',
  '1368  2139',
  '1369  2140       Valsartan Tablets IP 40 mg               10\'s',
  '1370  2141',
  '                 Zinc Sulphate Dispersible Tablets IP 20mg  10\'s',
].join('\n');

const COMPLETE_EXTRACT = [
  'S. No. Drug      Generic Name of Item                     Unit Size',
  '1367  2138       Torsemide Tablets IP 100mg               10\'s',
  '1368  2139       Valsartan Tablets IP 40 mg               10\'s',
  '1369  2140       Verapamil Tablets IP 40mg                10\'s',
  '1370  2141       Warfarin Tablets IP 1mg                  10\'s',
].join('\n');

test('countJanAushadhiSerials reads the in-document ground truth', () => {
  assert.equal(countJanAushadhiSerials(LOSSY_EXTRACT), 4);
  assert.equal(countJanAushadhiSerials(COMPLETE_EXTRACT), 4);
});

test('a lossy extraction is detected rather than silently accepted', () => {
  const rows = parseJanAushadhiText(LOSSY_EXTRACT, '2026-07-27');
  const integrity = janAushadhiParseIntegrity(LOSSY_EXTRACT, rows);
  assert.equal(integrity.serials_in_document, 4);
  assert.ok(integrity.parsed_rows < integrity.serials_in_document);
  assert.equal(integrity.complete, false);
  assert.throws(
    () => assertJanAushadhiParseComplete(LOSSY_EXTRACT, rows),
    /extraction is lossy: parsed \d+ rows but the document contains \d+/u,
  );
});

test('a complete extraction passes the integrity assertion', () => {
  const rows = parseJanAushadhiText(COMPLETE_EXTRACT, '2026-07-27');
  const integrity = assertJanAushadhiParseComplete(COMPLETE_EXTRACT, rows);
  assert.equal(integrity.complete, true);
  assert.equal(integrity.parsed_rows, integrity.serials_in_document);

  // and the pairing is the one the catalogue actually holds
  const byCode = new Map(rows.map((row) => [String(row.source_id), row.brand_name]));
  assert.equal(byCode.get('2141'), 'Warfarin Tablets IP 1mg');
  assert.equal(byCode.get('2140'), 'Verapamil Tablets IP 40mg');
});

test('pdfToText exposes table mode and rejects an unknown mode', async () => {
  await assert.rejects(
    () => pdfToText('x.pdf', 'x.txt', { mode: 'bbox' }),
    /mode must be "layout" or "table"/u,
  );
});

// ── name agreement must not be satisfied by the molecule alone ───────────────
//
// Audit finding, 2026-07-28. namesAgree() compared the leading molecule token and
// every numeric strength, but short-circuited to TRUE whenever EITHER side carried
// no parseable strength. A mapping named without a strength would then confirm
// against any row sharing its first token -- including a different dosage form, so
// an oral-tablet mapping could confirm against an injection. That is the presentation
// inference the standing prohibitions forbid.
//
// Not exploitable by the committed 18 (all carry strengths on both sides, verified
// against the official list), and tightening keeps all 18 confirmed. Fixed rather
// than left as headroom.
test('name agreement rejects a strengthless match across dosage forms', () => {
  // the case that motivated the fix
  assert.equal(namesAgree('Warfarin Tablets IP', 'Warfarin Sodium Injection 5mg'), false);
  assert.equal(namesAgree('Warfarin Tablets IP 1mg', 'Warfarin Injection'), false);
});

test('name agreement still accepts a genuine match and rejects real mismatches', () => {
  assert.equal(namesAgree('Warfarin Tablets IP 1mg', 'Warfarin Tablets IP 1mg'), true);
  // spacing and case differences are normalised away
  assert.equal(namesAgree('Warfarin Tablets IP 5 mg', 'warfarin tablets ip 5mg'), true);
  // same molecule, different strength -- the subtle code-swap case
  assert.equal(namesAgree('Warfarin Tablets IP 1mg', 'Warfarin Tablets IP 2mg'), false);
  assert.equal(namesAgree('Amiodarone Tablets IP 100 mg', 'Amiodarone Tablets IP 200 mg'), false);
  // different molecule at the same strength
  assert.equal(
    namesAgree('Clarithromycin Tablets IP 250 mg', 'Azithromycin Tablets IP 250 mg'),
    false,
  );
});

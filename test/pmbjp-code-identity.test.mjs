// Regression guards for the F5 remediation: PMBJP drug codes are not stable across
// product-list editions, so (a) every catalogue snapshot must record which source
// document it was parsed from, and (b) a mapping's code citation must be checkable
// against a named source and fail closed when it cannot be confirmed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PMBJP_PROVENANCE_FILENAME,
  parseJanAushadhiText,
  readJanAushadhiProvenance,
  writeJanAushadhiProvenance,
} from '../src/adapters/janaushadhi.mjs';

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

  // this is exactly the state the 2026-07-07 catalogue snapshot is in: the source
  // document is gone, so its drug codes cannot be attributed to any edition
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

test('the committed mappings carry PMBJP codes that are not yet confirmed against any named source', () => {
  // F5 quarantine: this documents the outstanding state rather than asserting it is
  // acceptable. When the catalogue's source edition is pinned and the citations are
  // re-verified, this expectation should be tightened to require full confirmation.
  const quarantine = JSON.parse(fs.readFileSync(
    path.resolve('docs/interaction-review/2026-07-27-pmbjp-code-identity-quarantine.json'),
    'utf8',
  ));
  assert.equal(quarantine.status, 'open');
  assert.equal(quarantine.mappings_checked, 17);
  assert.ok(quarantine.unconfirmed_count > 0);
  assert.equal(
    quarantine.confirmed_count + quarantine.unconfirmed_count,
    quarantine.mappings_checked,
  );
  assert.equal(quarantine.runtime_risk, 'low_content_hash_bound');
  assert.equal(quarantine.blocks_new_pmbjp_mappings, true);
});

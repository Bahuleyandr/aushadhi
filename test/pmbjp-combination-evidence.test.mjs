import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  assertPhysicalDirectoryPath,
  assertVerifiedPmbjpCombinationEvidence,
  verifyPmbjpCombinationEvidenceFiles,
} from '../src/lib/pmbjp-combination-evidence.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RESTRICTED_ROOT = path.join(
  ROOT,
  'data',
  'interaction',
  'internal-evaluation',
);
const SOURCE_ROOT = path.join(RESTRICTED_ROOT, 'pmbjp-product-list');
const SOURCE = Object.freeze({
  restrictedRoot: RESTRICTED_ROOT,
  pdfPath: path.join(SOURCE_ROOT, 'pmbjp-product-list.pdf'),
  tableTextPath: path.join(SOURCE_ROOT, 'pmbjp-product-list.table.txt'),
});

const loadManifest = () => JSON.parse(fs.readFileSync(
  path.join(ROOT, 'data-static', 'combination-identity-overrides.json'),
  'utf8',
));

test('PMBJP source verification returns a non-forgeable report bound to one manifest', () => {
  const manifest = loadManifest();
  const report = verifyPmbjpCombinationEvidenceFiles(manifest, SOURCE);

  assert.equal(report.verified, true);
  assert.strictEqual(
    assertVerifiedPmbjpCombinationEvidence(report, manifest),
    report,
  );
  assert.throws(
    () => assertVerifiedPmbjpCombinationEvidence(
      { ...report },
      manifest,
    ),
    /not an authentic verifier result/u,
  );
  assert.throws(
    () => assertVerifiedPmbjpCombinationEvidence(report, structuredClone(manifest)),
    /not bound to this exact manifest object/u,
  );
});

test('PMBJP source authority expires when the reviewed manifest changes', () => {
  const manifest = loadManifest();
  const report = verifyPmbjpCombinationEvidenceFiles(manifest, SOURCE);
  manifest.combinations[0].presentations[0].source_identity.code = '88';

  assert.throws(
    () => assertVerifiedPmbjpCombinationEvidence(report, manifest),
    /changed since PMBJP source verification/u,
  );
});

test('PMBJP source files are refused outside the restricted internal-evaluation root', () => {
  const manifest = loadManifest();
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-pmbjp-boundary-'));
  const outsidePdf = path.join(scratch, 'outside.pdf');
  const outsideTable = path.join(scratch, 'outside.table.txt');
  fs.copyFileSync(SOURCE.pdfPath, outsidePdf);
  fs.copyFileSync(SOURCE.tableTextPath, outsideTable);

  try {
    assert.throws(
      () => verifyPmbjpCombinationEvidenceFiles(manifest, {
        restrictedRoot: scratch,
        pdfPath: outsidePdf,
        tableTextPath: outsideTable,
      }),
      /verifier-owned source zone/u,
    );
    assert.throws(
      () => verifyPmbjpCombinationEvidenceFiles(manifest, {
        restrictedRoot: RESTRICTED_ROOT,
        pdfPath: outsidePdf,
        tableTextPath: outsideTable,
      }),
      /must remain inside/u,
    );
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('the restricted-source boundary rejects a junction root and a junction ancestor', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'aushadhi-pmbjp-junction-'));
  const physicalTarget = path.join(scratch, 'physical-target');
  const nestedTarget = path.join(physicalTarget, 'nested');
  const linkedRoot = path.join(scratch, 'linked-root');
  fs.mkdirSync(nestedTarget, { recursive: true });
  fs.symlinkSync(
    physicalTarget,
    linkedRoot,
    process.platform === 'win32' ? 'junction' : 'dir',
  );

  try {
    assert.throws(
      () => assertPhysicalDirectoryPath(linkedRoot, 'restricted source root'),
      /symbolic link|junction|reparse/u,
    );
    assert.throws(
      () => assertPhysicalDirectoryPath(
        path.join(linkedRoot, 'nested'),
        'restricted source root',
      ),
      /symbolic link|junction|reparse/u,
    );
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

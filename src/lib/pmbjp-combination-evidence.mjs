import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  assertJanAushadhiParseComplete,
  parseJanAushadhiText,
} from '../adapters/janaushadhi.mjs';
import {
  productAssertionForRow,
  productAssertionHashForRow,
  productIdForRow,
} from './product-resolver.mjs';
import { strictPlainDataSnapshot } from './strict-plain-data.mjs';

const MANIFEST_REPORT_BINDINGS = new WeakMap();
const PMBJP_IDENTIFIER = /^pmbjp-product-list:(\d+(?:,\d+)*)$/u;
const TRUSTED_RESTRICTED_ROOT = path.resolve(fileURLToPath(
  new URL('../../data/interaction/internal-evaluation/', import.meta.url),
));
const TRUSTED_DOCUMENT = Object.freeze({
  source_id: 'janaushadhi',
  source_url: 'https://static.pib.gov.in/WriteReadData/specificdocs/documents/2026/feb/doc202626781701.pdf',
  pdf_sha256: 'f54a140d9dc82880dcbb7672c18942417e8c9fe904376c742b6319665cdf9a08',
  pdf_byte_count: 1670737,
  table_text_sha256: 'bb5a5eabbda1802313b546c6b3605315c8bf4f113825ca1794724dab84e1f299',
  parsed_row_ledger_sha256: '336b9ea72d2a249edac467bc9ec2c2c052520878ea13d7fdb4c8a4d7f8281688',
  parsed_row_count: 2111,
  extraction_tool: 'Xpdf pdftotext 4.06',
  extraction_mode: 'table',
});

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sameSet = (left, right) => (
  left.size === right.size && [...left].every((value) => right.has(value))
);

function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function samePlainData(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((entry, index) => samePlainData(entry, right[index]));
  }
  if (left === null || right === null
      || typeof left !== 'object' || typeof right !== 'object') {
    return false;
  }
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => (
      key === rightKeys[index] && samePlainData(left[key], right[key])
    ));
}

function finding(code, detail) {
  return { code, detail };
}

function reviewedPmbjpPresentations(snapshot) {
  return snapshot.combinations.flatMap((combination) => (
    combination.presentations
      .filter((presentation) => presentation.source_identity?.namespace === 'presentation:pmbjp')
      .map((presentation) => ({ combination, presentation }))
  ));
}

function officialListEvidence(combination) {
  const refs = new Set(
    (combination.provenance?.identity_sources ?? [])
      .filter((source) => source.kind === 'official_product_list')
      .map((source) => source.evidence_ref),
  );
  const matching = (combination.review?.evidence ?? []).filter((evidence) => (
    refs.has(evidence.evidence_ref) && evidence.source_id === TRUSTED_DOCUMENT.source_id
  ));
  return matching.length === 1 ? matching[0] : null;
}

function verifySourceBytes(findings, pdfBytes, tableTextBytes) {
  if (!Buffer.isBuffer(pdfBytes)) {
    findings.push(finding(
      'missing_pmbjp_pdf',
      'the restricted official PMBJP PDF is required for combination identity verification',
    ));
  } else {
    if (pdfBytes.length !== TRUSTED_DOCUMENT.pdf_byte_count) {
      findings.push(finding(
        'pmbjp_pdf_size_mismatch',
        `expected ${TRUSTED_DOCUMENT.pdf_byte_count} bytes but received ${pdfBytes.length}`,
      ));
    }
    const digest = sha256(pdfBytes);
    if (digest !== TRUSTED_DOCUMENT.pdf_sha256) {
      findings.push(finding(
        'pmbjp_pdf_hash_mismatch',
        `expected ${TRUSTED_DOCUMENT.pdf_sha256} but received ${digest}`,
      ));
    }
  }
  if (!Buffer.isBuffer(tableTextBytes)) {
    findings.push(finding(
      'missing_pmbjp_table_extract',
      `a ${TRUSTED_DOCUMENT.extraction_tool} -${TRUSTED_DOCUMENT.extraction_mode} extract is required`,
    ));
  } else {
    const digest = sha256(tableTextBytes);
    if (digest !== TRUSTED_DOCUMENT.table_text_sha256) {
      findings.push(finding(
        'pmbjp_table_extract_hash_mismatch',
        `expected ${TRUSTED_DOCUMENT.table_text_sha256} but received ${digest}`,
      ));
    }
  }
}

function verifyPmbjpCombinationEvidence(
  manifest,
  { pdfBytes = null, tableTextBytes = null } = {},
  { mintCapability = false } = {},
) {
  const snapshot = strictPlainDataSnapshot(manifest, 'combination identity manifest');
  const presentations = reviewedPmbjpPresentations(snapshot);
  const findings = [];
  let rows = [];

  if (presentations.length > 0) {
    verifySourceBytes(findings, pdfBytes, tableTextBytes);
    if (Buffer.isBuffer(tableTextBytes)
        && sha256(tableTextBytes) === TRUSTED_DOCUMENT.table_text_sha256) {
      const text = tableTextBytes.toString('utf8');
      try {
        rows = parseJanAushadhiText(text, 'verification');
        const integrity = assertJanAushadhiParseComplete(text, rows);
        if (integrity.parsed_rows !== TRUSTED_DOCUMENT.parsed_row_count) {
          findings.push(finding(
            'pmbjp_source_row_count_mismatch',
            `expected ${TRUSTED_DOCUMENT.parsed_row_count} rows but parsed `
            + `${integrity.parsed_rows}`,
          ));
        }
        const ledger = rows.map((row) => (
          `${JSON.stringify([String(row.source_id), productAssertionForRow(row)])}\n`
        )).join('');
        const ledgerDigest = sha256(Buffer.from(ledger, 'utf8'));
        if (ledgerDigest !== TRUSTED_DOCUMENT.parsed_row_ledger_sha256) {
          findings.push(finding(
            'pmbjp_source_ledger_mismatch',
            `expected parsed-row ledger ${TRUSTED_DOCUMENT.parsed_row_ledger_sha256} but `
            + `received ${ledgerDigest}`,
          ));
        }
      } catch (error) {
        findings.push(finding('pmbjp_source_parse_failed', error.message));
      }
    }
  }

  const rowsByCode = new Map();
  const duplicateCodes = new Set();
  for (const row of rows) {
    const code = String(row.source_id);
    if (rowsByCode.has(code)) duplicateCodes.add(code);
    else rowsByCode.set(code, row);
  }

  const expectedCodesByCombination = new Map();
  for (const { combination, presentation } of presentations) {
    const code = String(presentation.source_identity.code);
    const label = `${combination.combination_id} presentation:pmbjp:${code}`;
    if (duplicateCodes.has(code)) {
      findings.push(finding('pmbjp_source_code_ambiguous', `${label} appears more than once`));
      continue;
    }
    const row = rowsByCode.get(code);
    if (row === undefined) {
      findings.push(finding('pmbjp_source_code_absent', `${label} is absent from the official list`));
      continue;
    }
    const expectedAssertion = productAssertionForRow(row);
    if (!samePlainData(expectedAssertion, presentation.product_assertion)) {
      findings.push(finding(
        'pmbjp_source_product_mismatch',
        `${label} does not equal the official source row field-for-field`,
      ));
    }
    if (productIdForRow(row) !== presentation.product_id) {
      findings.push(finding(
        'pmbjp_source_product_id_mismatch',
        `${label} official row does not hash to the reviewed product_id`,
      ));
    }
    if (productAssertionHashForRow(row) !== presentation.product_assertion_sha256) {
      findings.push(finding(
        'pmbjp_source_assertion_hash_mismatch',
        `${label} official row does not hash to the reviewed product assertion`,
      ));
    }
    const expectedCodes = expectedCodesByCombination.get(combination) ?? new Set();
    expectedCodes.add(code);
    expectedCodesByCombination.set(combination, expectedCodes);
  }

  for (const combination of snapshot.combinations) {
    const expectedCodes = expectedCodesByCombination.get(combination);
    if (expectedCodes === undefined) continue;
    const evidence = officialListEvidence(combination);
    if (evidence === null) {
      findings.push(finding(
        'missing_trusted_pmbjp_review_evidence',
        `${combination.combination_id} has no unique official product-list evidence record`,
      ));
      continue;
    }
    if (evidence.source_url !== TRUSTED_DOCUMENT.source_url
        || evidence.evidence_sha256 !== TRUSTED_DOCUMENT.pdf_sha256) {
      findings.push(finding(
        'pmbjp_review_document_mismatch',
        `${combination.combination_id} is not bound to the trusted PMBJP source document`,
      ));
    }
    const identifierMatch = PMBJP_IDENTIFIER.exec(evidence.identifier ?? '');
    const declaredCodes = identifierMatch === null
      ? new Set()
      : new Set(identifierMatch[1].split(','));
    if (identifierMatch === null || !sameSet(declaredCodes, expectedCodes)) {
      findings.push(finding(
        'pmbjp_review_identifier_mismatch',
        `${combination.combination_id} review identifier must name exactly `
        + `${[...expectedCodes].sort().join(',')}`,
      ));
    }
  }

  const report = deepFreeze({
    verified: findings.length === 0,
    presentations_checked: presentations.length,
    source_document_sha256: presentations.length === 0
      ? null
      : TRUSTED_DOCUMENT.pdf_sha256,
    source_table_sha256: presentations.length === 0
      ? null
      : TRUSTED_DOCUMENT.table_text_sha256,
    findings,
  });
  if (report.verified && mintCapability) {
    MANIFEST_REPORT_BINDINGS.set(report, {
      manifest,
      fingerprint: sha256(Buffer.from(JSON.stringify(snapshot), 'utf8')),
    });
  }
  return report;
}

function requireRestrictedSourcePath(file, restrictedRoot, label) {
  assertPhysicalDirectoryPath(restrictedRoot, 'verifier-owned restricted source root');
  const realRoot = fs.realpathSync(restrictedRoot);
  const realFile = fs.realpathSync(file);
  const relative = path.relative(realRoot, realFile);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new TypeError(`${label} must remain inside ${realRoot}`);
  }
  return realFile;
}

export function assertPhysicalDirectoryPath(directory, label = 'directory') {
  if (typeof directory !== 'string' || directory.trim() === '') {
    throw new TypeError(`${label} must be a non-empty path`);
  }
  const absolute = path.resolve(directory);
  const parsed = path.parse(absolute);
  const relative = path.relative(parsed.root, absolute);
  const segments = relative === '' ? [] : relative.split(path.sep);
  let current = parsed.root;
  for (const segment of segments) {
    current = path.join(current, segment);
    const stats = fs.lstatSync(current);
    if (stats.isSymbolicLink()) {
      throw new TypeError(
        `${label} may not contain a symbolic link, junction, or reparse-point directory`,
      );
    }
    if (!stats.isDirectory()) {
      throw new TypeError(`${label} must resolve through physical directories only`);
    }
  }
  return absolute;
}

export function verifyPmbjpCombinationEvidenceFiles(
  manifest,
  { pdfPath, tableTextPath, restrictedRoot },
) {
  const presentations = reviewedPmbjpPresentations(
    strictPlainDataSnapshot(manifest, 'combination identity manifest'),
  );
  if (presentations.length === 0) return verifyPmbjpCombinationEvidence(manifest);
  // A restricted root that does not exist at all (fresh clone: data/ is
  // gitignored and never committed) means the operator-provisioned sources are
  // absent — the same fail-closed degradation as missing source files below:
  // return an unverified report instead of leaking a raw ENOENT. Any other
  // lstat failure (symlink, non-directory, permission) still throws.
  let trustedRoot;
  try {
    trustedRoot = assertPhysicalDirectoryPath(
      TRUSTED_RESTRICTED_ROOT,
      'verifier-owned restricted source root',
    );
  } catch (error) {
    if (error?.code === 'ENOENT') return verifyPmbjpCombinationEvidence(manifest);
    throw error;
  }
  if (restrictedRoot !== undefined) {
    if (typeof restrictedRoot !== 'string' || restrictedRoot.trim() === '') {
      throw new TypeError('restrictedRoot must be a non-empty string when supplied');
    }
    const suppliedRoot = assertPhysicalDirectoryPath(
      restrictedRoot,
      'supplied restricted source root',
    );
    if (path.relative(trustedRoot, suppliedRoot) !== '') {
      throw new TypeError(
        `restrictedRoot must equal the verifier-owned source zone ${trustedRoot}`,
      );
    }
  }
  if (!fs.existsSync(pdfPath) || !fs.existsSync(tableTextPath)) {
    return verifyPmbjpCombinationEvidence(manifest);
  }
  const verifiedPdfPath = requireRestrictedSourcePath(
    pdfPath,
    trustedRoot,
    'PMBJP PDF',
  );
  const verifiedTextPath = requireRestrictedSourcePath(
    tableTextPath,
    trustedRoot,
    'PMBJP table extract',
  );
  return verifyPmbjpCombinationEvidence(
    manifest,
    {
      pdfBytes: fs.readFileSync(verifiedPdfPath),
      tableTextBytes: fs.readFileSync(verifiedTextPath),
    },
    { mintCapability: true },
  );
}

export function assertVerifiedPmbjpCombinationEvidence(report, manifest) {
  if (!report || typeof report !== 'object' || !MANIFEST_REPORT_BINDINGS.has(report)) {
    throw new TypeError('PMBJP combination evidence report is not an authentic verifier result');
  }
  const binding = MANIFEST_REPORT_BINDINGS.get(report);
  if (binding.manifest !== manifest) {
    throw new TypeError('PMBJP combination evidence report is not bound to this exact manifest object');
  }
  const current = strictPlainDataSnapshot(manifest, 'combination identity manifest');
  const fingerprint = sha256(Buffer.from(JSON.stringify(current), 'utf8'));
  if (fingerprint !== binding.fingerprint) {
    throw new TypeError('combination identity manifest changed since PMBJP source verification');
  }
  if (report.verified !== true) {
    throw new TypeError('PMBJP combination evidence report is not verified');
  }
  return report;
}

export const PMBJP_COMBINATION_SOURCE_CONTRACT = TRUSTED_DOCUMENT;
export const PMBJP_COMBINATION_RESTRICTED_ROOT = TRUSTED_RESTRICTED_ROOT;

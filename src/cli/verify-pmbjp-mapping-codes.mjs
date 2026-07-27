// Verify that every committed PMBJP product-presentation mapping's drug code
// actually denotes the product that mapping is bound to.
//
// Why this exists: PMBJP drug codes are NOT stable across product-list editions.
// The same product carries different codes in different documents, so a
// `presentation:pmbjp:<code>:...` mapping id — and the `pmbjp-tender:...:<code>:page-N`
// evidence citation beside it — is only meaningful against a named source document.
// Mapping resolution itself keys on product_id (a content hash) and revalidates
// product_assertion_sha256, so a wrong code cannot mis-resolve at runtime; what a
// wrong code corrupts is the human evidence chain. This check fails closed.
//
// usage:
//   node src/cli/verify-pmbjp-mapping-codes.mjs --list=<pmbjp-list.txt|pdf> [--sha256=<expected>]
//                                               [--catalogue=<drugs.jsonl>] [--json]
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { createHash } from 'node:crypto';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parseJanAushadhiText } from '../adapters/janaushadhi.mjs';
import { pdfToText } from '../lib/pdftotext.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_CATALOGUE = path.join(ROOT, 'dist', 'latest', 'drugs.jsonl');
const MAPPING_PATH = path.join(ROOT, 'data-static', 'product-presentation-overrides.json');

const MAPPING_ID_RE = /^presentation:pmbjp:(\d+):/u;

function argValue(argv, name) {
  const hit = argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.slice(`--${name}=`.length) : null;
}

function normaliseName(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/gu, ' ').trim();
}

// A tender/list row and a catalogue row describe the same product when their
// leading molecule token and every numeric strength token agree. Comparing whole
// strings is too brittle (pack columns bleed into extracted names).
function productSignature(value) {
  const text = normaliseName(value);
  const head = text.split(' ')[0] ?? '';
  const strengths = [...text.matchAll(/\b(\d+(?:\.\d+)?)\s*(mg|mcg|ml|g|iu)\b/gu)]
    .map((match) => `${match[1]}${match[2]}`);
  return { head, strengths: strengths.sort() };
}

function signaturesAgree(a, b) {
  if (!a.head || !b.head) return false;
  if (a.head !== b.head) return false;
  if (a.strengths.length === 0 || b.strengths.length === 0) return true;
  return a.strengths.join(',') === b.strengths.join(',');
}

// -layout extraction sometimes appends the following row's text to a row, so an
// otherwise-exact match can carry trailing junk. A source entry that *begins with*
// the mapped product name is the same product; a differing leading molecule is not.
function namesAgree(mappedName, sourceName) {
  const mapped = normaliseName(mappedName);
  const source = normaliseName(sourceName);
  if (!mapped || !source) return false;
  if (source.startsWith(mapped)) return true;
  return signaturesAgree(productSignature(mapped), productSignature(source));
}

async function loadOfficialList(listPath) {
  let textPath = listPath;
  if (listPath.toLowerCase().endsWith('.pdf')) {
    textPath = `${listPath}.txt`;
    const result = await pdfToText(listPath, textPath);
    if (result.skipped) throw new Error(result.skipped);
  }
  const rows = parseJanAushadhiText(fs.readFileSync(textPath, 'utf8'), 'verification');
  const byCode = new Map();
  for (const row of rows) {
    if (!byCode.has(String(row.source_id))) byCode.set(String(row.source_id), row.brand_name);
  }
  return byCode;
}

async function loadCatalogueByProductId(cataloguePath, wantedProductIds) {
  const { productIdForRow } = await import('../lib/product-resolver.mjs');
  const found = new Map();
  const stream = readline.createInterface({
    input: fs.createReadStream(cataloguePath),
    crlfDelay: Infinity,
  });
  for await (const line of stream) {
    if (!line.includes('janaushadhi')) continue;
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    const productId = productIdForRow(row);
    if (!wantedProductIds.has(productId)) continue;
    found.set(productId, row);
    if (found.size === wantedProductIds.size) break;
  }
  return found;
}

export async function verifyPmbjpMappingCodes({ listPath, expectedSha256, cataloguePath }) {
  if (expectedSha256) {
    const digest = createHash('sha256').update(fs.readFileSync(listPath)).digest('hex');
    if (digest !== expectedSha256) {
      throw new Error(`source list sha256 mismatch: expected ${expectedSha256}, got ${digest}`);
    }
  }

  const manifest = JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf8'));
  const officialByCode = await loadOfficialList(listPath);
  const wanted = new Set(manifest.mappings.map((mapping) => mapping.product_id));
  const catalogue = await loadCatalogueByProductId(cataloguePath, wanted);

  const results = [];
  for (const mapping of manifest.mappings) {
    const codeMatch = MAPPING_ID_RE.exec(mapping.mapping_id);
    const code = codeMatch ? codeMatch[1] : null;
    const row = catalogue.get(mapping.product_id);
    const officialName = code ? officialByCode.get(code) ?? null : null;

    let status;
    if (!code) status = 'unparseable_mapping_id';
    else if (!row) status = 'catalogue_row_missing';
    else if (officialName === null) status = 'code_absent_from_source_list';
    else {
      status = namesAgree(row.brand_name, officialName)
        ? 'confirmed'
        : 'code_denotes_a_different_product';
    }

    results.push({
      mapping_id: mapping.mapping_id,
      pmbjp_code: code,
      mapped_product: row?.brand_name ?? null,
      source_list_product: officialName,
      status,
    });
  }

  const counts = results.reduce((acc, entry) => {
    acc[entry.status] = (acc[entry.status] ?? 0) + 1;
    return acc;
  }, {});
  return {
    source_list: path.relative(ROOT, listPath).replaceAll('\\', '/'),
    source_list_sha256: createHash('sha256').update(fs.readFileSync(listPath)).digest('hex'),
    mappings_checked: results.length,
    counts,
    confirmed: results.filter((entry) => entry.status === 'confirmed').length,
    unconfirmed: results.filter((entry) => entry.status !== 'confirmed'),
    results,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const argv = process.argv.slice(2);
  const listPath = argValue(argv, 'list');
  if (!listPath) {
    process.stderr.write('usage: --list=<pmbjp-list.txt|pdf> [--sha256=] [--catalogue=] [--json]\n');
    process.exitCode = 1;
  } else {
    try {
      const summary = await verifyPmbjpMappingCodes({
        listPath: path.resolve(listPath),
        expectedSha256: argValue(argv, 'sha256'),
        cataloguePath: path.resolve(argValue(argv, 'catalogue') ?? DEFAULT_CATALOGUE),
      });
      if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
      } else {
        process.stdout.write(`source list: ${summary.source_list}\n`);
        process.stdout.write(`sha256: ${summary.source_list_sha256}\n`);
        process.stdout.write(`checked ${summary.mappings_checked} mappings\n`);
        for (const [status, count] of Object.entries(summary.counts)) {
          process.stdout.write(`  ${status}: ${count}\n`);
        }
        for (const entry of summary.unconfirmed) {
          process.stdout.write(
            `\n  ! ${entry.mapping_id} [${entry.status}]\n`
            + `      mapped:      ${entry.mapped_product}\n`
            + `      source list: ${entry.source_list_product}\n`,
          );
        }
      }
      // fail closed: an unverifiable code citation is not an acceptable resting state
      if (summary.unconfirmed.length > 0) process.exitCode = 1;
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    }
  }
}

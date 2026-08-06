// Verify that every committed PMBJP product-presentation mapping's drug code
// actually denotes the product that mapping is bound to.
//
// Why this exists: a `presentation:pmbjp:<code>:...` mapping id — and the
// `pmbjp-tender:...:<code>:page-N` evidence citation beside it — is only meaningful
// against a named source document, and PMBJP reissues its product list. Mapping
// resolution itself keys on product_id (a content hash) and revalidates
// product_assertion_sha256, so a wrong code cannot mis-resolve at runtime; what a
// wrong code would corrupt is the human evidence chain. This check fails closed.
//
// The source list MUST be extracted in table mode. Reading this ruled table with
// -layout orphans 632 of 2111 name cells and makes every code look wrong — that
// mistake is what raised the F5 false alarm, so loadOfficialList pins the mode and
// asserts row completeness before comparing anything.
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

import { assertJanAushadhiParseComplete, parseJanAushadhiText } from '../adapters/janaushadhi.mjs';
import { resolvePublishedCohort } from '../lib/build-cohort.mjs';
import { pdfToText } from '../lib/pdftotext.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
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
  // Both sides must carry a strength. This branch used to return true when EITHER
  // side had none, which meant agreement rested on the leading molecule token alone
  // -- so an oral-tablet mapping could confirm against an injection row of the same
  // molecule. That is exactly the presentation inference the standing prohibitions
  // forbid. All 18 committed mappings carry strengths on both sides, so tightening
  // costs nothing and removes the headroom.
  if (a.strengths.length === 0 || b.strengths.length === 0) return false;
  return a.strengths.join(',') === b.strengths.join(',');
}

// -layout extraction sometimes appends the following row's text to a row, so an
// otherwise-exact match can carry trailing junk. A source entry that *begins with*
// the mapped product name is the same product; a differing leading molecule is not.
export function namesAgree(mappedName, sourceName) {
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
    // MUST be table mode. -layout orphans 632 of 2111 name cells on this document,
    // which is precisely what produced the F5 false alarm: every mapping code then
    // appears to denote a different drug.
    const result = await pdfToText(listPath, textPath, { mode: 'table' });
    if (result.skipped) throw new Error(result.skipped);
  }
  const rows = parseJanAushadhiText(fs.readFileSync(textPath, 'utf8'), 'verification');
  assertJanAushadhiParseComplete(fs.readFileSync(textPath, 'utf8'), rows);
  const byCode = new Map();
  for (const row of rows) {
    if (!byCode.has(String(row.source_id))) byCode.set(String(row.source_id), row.brand_name);
  }
  return byCode;
}

// D2: the check is on the RESOLVER BINDING, not merely on a code appearing in a
// list. A reviewed mapping is located by the catalogue's stable source identity,
// and the catalogue is swept in full so a source identity claimed by two rows is an
// error rather than whichever row happened to be read first.
async function loadCatalogueBindings(cataloguePath, wantedSourceKeys) {
  const { productIdForRow, productAssertionHashForRow } = await import('../lib/product-resolver.mjs');
  const { productSourceIdentityKeys } = await import('../lib/interaction-mapping.mjs');
  const bySourceKey = new Map();
  const duplicates = new Set();
  const stream = readline.createInterface({
    input: fs.createReadStream(cataloguePath),
    crlfDelay: Infinity,
  });
  for await (const line of stream) {
    if (!line.includes('janaushadhi')) continue;
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    for (const key of productSourceIdentityKeys(row)) {
      if (!wantedSourceKeys.has(key)) continue;
      if (bySourceKey.has(key)) {
        duplicates.add(key);
        continue;
      }
      bySourceKey.set(key, {
        row,
        product_id: productIdForRow(row),
        product_assertion_sha256: productAssertionHashForRow(row),
      });
    }
  }
  return { bySourceKey, duplicates };
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
  const wantedSourceKeys = new Set(
    manifest.mappings
      .filter((mapping) => mapping.source_identity !== undefined)
      .map((mapping) => `${mapping.source_identity.namespace}:${mapping.source_identity.code}`),
  );
  const { bySourceKey, duplicates } = await loadCatalogueBindings(cataloguePath, wantedSourceKeys);

  const results = [];
  for (const mapping of manifest.mappings) {
    const codeMatch = MAPPING_ID_RE.exec(mapping.mapping_id);
    const code = codeMatch ? codeMatch[1] : null;
    const sourceKey = mapping.source_identity === undefined
      ? null
      : `${mapping.source_identity.namespace}:${mapping.source_identity.code}`;
    const binding = sourceKey === null ? undefined : bySourceKey.get(sourceKey);
    const row = binding?.row;
    const officialName = code ? officialByCode.get(code) ?? null : null;

    let status;
    if (!code) status = 'unparseable_mapping_id';
    else if (sourceKey === null) status = 'mapping_not_source_bound';
    else if (duplicates.has(sourceKey)) status = 'source_identity_claimed_by_several_rows';
    else if (!binding) status = 'source_identity_absent_from_catalogue';
    else if (binding.product_id !== mapping.product_id) status = 'bound_product_id_changed';
    else if (binding.product_assertion_sha256 !== mapping.product_assertion_sha256) {
      status = 'bound_product_assertion_changed';
    } else if (officialName === null) status = 'code_absent_from_source_list';
    else {
      status = namesAgree(row.brand_name, officialName)
        ? 'confirmed'
        : 'code_denotes_a_different_product';
    }

    results.push({
      mapping_id: mapping.mapping_id,
      pmbjp_code: code,
      source_identity: sourceKey,
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
      let cataloguePath = argValue(argv, 'catalogue');
      if (cataloguePath === null) {
        const published = await resolvePublishedCohort({
          distRoot: path.resolve(process.env.AUSHADHI_DIST_ROOT ?? path.join(ROOT, 'dist')),
          verifyFiles: ['drugs.jsonl'],
        });
        cataloguePath = path.join(published.dir, 'drugs.jsonl');
      }
      const summary = await verifyPmbjpMappingCodes({
        listPath: path.resolve(listPath),
        expectedSha256: argValue(argv, 'sha256'),
        cataloguePath: path.resolve(cataloguePath),
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

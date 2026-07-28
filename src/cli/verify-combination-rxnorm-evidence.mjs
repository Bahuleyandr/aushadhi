// Mandatory gate: no non-fixture combination may enter even the internal-evaluation
// manifest without passing this. Runs entirely offline against a committed raw
// evidence bundle, so it is reproducible and needs no network in CI.
//
//   npm run verify:combination-rxnorm-evidence [-- --bundles=<dir>] [--json]
//
// Exit 0 when every combination verifies (an empty manifest verifies vacuously and
// says so). Exit 1 on any finding.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateCombinationIdentityManifest } from '../lib/interaction-combination-identity.mjs';
import { verifyCombinationManifestEvidence } from '../lib/combination-rxnorm-evidence.mjs';
import { verifyPmbjpCombinationEvidenceFiles } from '../lib/pmbjp-combination-evidence.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_MANIFEST = path.join(ROOT, 'data-static', 'combination-identity-overrides.json');
const DEFAULT_BUNDLES = path.join(ROOT, 'data-static', 'combination-rxnorm-evidence');
const RESTRICTED_ROOT = path.join(ROOT, 'data', 'interaction', 'internal-evaluation');
const DEFAULT_PMBJP_SOURCE = path.join(RESTRICTED_ROOT, 'pmbjp-product-list');

export function parseArgs(args) {
  const options = {
    manifest: DEFAULT_MANIFEST,
    bundles: DEFAULT_BUNDLES,
    pmbjpList: path.join(DEFAULT_PMBJP_SOURCE, 'pmbjp-product-list.pdf'),
    pmbjpTable: path.join(DEFAULT_PMBJP_SOURCE, 'pmbjp-product-list.table.txt'),
    json: false,
  };
  for (const arg of args) {
    if (arg === '--json') options.json = true;
    else if (arg.startsWith('--manifest=')) options.manifest = path.resolve(ROOT, arg.slice(11));
    else if (arg.startsWith('--bundles=')) options.bundles = path.resolve(ROOT, arg.slice(10));
    else if (arg.startsWith('--pmbjp-list=')) {
      options.pmbjpList = path.resolve(ROOT, arg.slice('--pmbjp-list='.length));
    } else if (arg.startsWith('--pmbjp-table=')) {
      options.pmbjpTable = path.resolve(ROOT, arg.slice('--pmbjp-table='.length));
    }
    else throw new Error(`unknown argument ${arg}`);
  }
  return options;
}

function loadBundles(dir, combinationIds) {
  const bundles = {};
  for (const combinationId of combinationIds) {
    const file = path.join(dir, `${combinationId.replaceAll(/[^a-zA-Z0-9._-]/gu, '_')}.json`);
    if (!fs.existsSync(file)) continue;
    bundles[combinationId] = JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  return bundles;
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const manifest = JSON.parse(fs.readFileSync(options.manifest, 'utf8'));
  validateCombinationIdentityManifest(manifest);
  const combinationIds = manifest.combinations.map((entry) => entry.combination_id);
  const bundles = loadBundles(options.bundles, combinationIds);
  const pmbjpSourceReport = verifyPmbjpCombinationEvidenceFiles(manifest, {
    restrictedRoot: RESTRICTED_ROOT,
    pdfPath: options.pmbjpList,
    tableTextPath: options.pmbjpTable,
  });
  const report = verifyCombinationManifestEvidence(
    manifest,
    bundles,
    { pmbjpSourceReport },
  );

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else if (report.combinations_checked === 0) {
    process.stdout.write(
      'combination manifest is empty: no RxNorm evidence to verify.\n'
      + 'This gate is mandatory before any non-fixture combination is authored.\n',
    );
  } else {
    process.stdout.write(`checked ${report.combinations_checked} combinations\n`);
    for (const entry of report.reports) {
      process.stdout.write(`  ${entry.verified ? 'verified' : 'FAILED  '} ${entry.combination_id}\n`);
      for (const finding of entry.findings) {
        process.stdout.write(`    ${finding.code}: ${finding.detail}\n`);
      }
    }
  }
  return report.verified ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1].replaceAll('\\', '/')}`
    || import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\', '/')}`).href) {
  process.exitCode = main();
}

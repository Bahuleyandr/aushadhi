// Shared expectation for the committed canonical production-open pack.
//
// Governance policy v1.1 (owner-approved 2026-08-07,
// docs/interaction-review/2026-08-07-production-open-promotion-governance/)
// replaces the blanket "production-open remains empty" invariant with a
// deterministic-content invariant: the pack must equal its deterministic
// recompilation from the owner-approved, digest-bound production-open
// manifests, and may never declare complete coverage.
//
// While no production-open promotions manifest is committed — which remains
// true until the owner signs the six per-rule clinician approvals, commits
// the production-open manifests through his own reviewed change, and the
// operator runs `npm run interactions:promote` — the deterministic result is
// the committed empty pack, and these assertions pin exactly that.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildCommittedProductionOpenArtifacts,
  committedProductionOpenManifestsPresent,
} from '../../src/cli/build-interaction-runtime-pack.mjs';
import {
  serializeInteractionRuntimePack,
} from '../../src/lib/interaction-promotion.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OPEN_PACK_PATH = path.join(ROOT, 'data-static', 'interaction-rules.json');

// The six rules whose production-open promotion scope the owner approved on
// 2026-08-07. A committed production-open promotions manifest naming any
// other rule set fails these assertions until this list is revised through
// another owner-approved change.
export const OWNER_APPROVED_PRODUCTION_OPEN_RULE_IDS = Object.freeze([
  'warfarin__amiodarone',
  'warfarin__clarithromycin_oral',
  'warfarin__fluconazole',
  'warfarin__ketoconazole_oral',
  'warfarin__metronidazole',
  'warfarin__voriconazole',
]);

export function assertCommittedProductionOpenPack() {
  const committedText = fs.readFileSync(OPEN_PACK_PATH, 'utf8');
  const pack = JSON.parse(committedText);
  assert.equal(pack.profile, 'production-open');
  assert.notEqual(
    pack.declared_coverage,
    'complete',
    'production-open coverage may never be declared complete',
  );
  if (!committedProductionOpenManifestsPresent()) {
    assert.deepEqual(
      pack.rules,
      [],
      'production-open pack must stay empty while no owner-approved '
        + 'production-open promotions manifest is committed',
    );
    assert.equal(pack.declared_coverage, 'unknown');
    return pack;
  }
  const artifacts = buildCommittedProductionOpenArtifacts();
  assert.equal(
    committedText,
    serializeInteractionRuntimePack(artifacts.rulePack),
    'production-open pack must equal its deterministic recompilation from '
      + 'the committed production-open manifests',
  );
  assert.deepEqual(
    artifacts.rulePack.rules.map((rule) => rule.rule_id),
    [...OWNER_APPROVED_PRODUCTION_OPEN_RULE_IDS],
    'production-open pack must contain exactly the owner-approved rules',
  );
  assert.ok(['unknown', 'partial'].includes(pack.declared_coverage));
  return pack;
}

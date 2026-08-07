import {
  serializeInteractionRuntimePack,
} from './interaction-promotion.mjs';
import { validateRulePack } from './interaction-checker.mjs';

export function assertProductionOpenPackMatchesAuthority({
  rules,
  rulesText,
  productionOpenManifestsPresent,
  compiledRulePack,
}) {
  if (typeof rulesText !== 'string' || rulesText.length === 0) {
    throw new TypeError('production-open rules text must be non-empty');
  }
  if (typeof productionOpenManifestsPresent !== 'boolean') {
    throw new TypeError('production-open manifest presence must be a boolean');
  }
  if (rules?.profile !== 'production-open') {
    throw new TypeError('production-open rules profile must be production-open');
  }
  if (!Array.isArray(rules.rules)) {
    throw new TypeError('production-open rules must be an array');
  }

  if (!productionOpenManifestsPresent) {
    if (rules.rules.length !== 0) {
      throw new TypeError(
        'production-open rules must remain empty while no production-open '
          + 'promotion manifests are committed',
      );
    }
    if (rules.declared_coverage !== 'unknown') {
      throw new TypeError(
        'production-open coverage must remain unknown while no production-open '
          + 'promotion manifests are committed',
      );
    }
    if (compiledRulePack !== null) {
      throw new TypeError(
        'compiled production-open rules must be null without promotion manifests',
      );
    }
    validateRulePack(rules);
    return true;
  }

  if (compiledRulePack === null || compiledRulePack === undefined) {
    throw new TypeError(
      'compiled production-open rules are required when promotion manifests are committed',
    );
  }
  validateRulePack(rules);
  validateRulePack(compiledRulePack);
  if (compiledRulePack.profile !== 'production-open') {
    throw new TypeError('compiled production-open rules profile must be production-open');
  }
  const expectedText = serializeInteractionRuntimePack(compiledRulePack);
  if (rulesText !== expectedText) {
    throw new TypeError(
      'production-open rules do not match their deterministic compilation from '
        + 'the committed promotion manifests',
    );
  }
  return true;
}

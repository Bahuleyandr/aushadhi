import { canonicalDrug } from './interaction-engine.mjs';

const TOP_LEVEL_FIELDS = new Set(['_meta', 'classes']);
const CLASS_NAME_PATTERN = /^[a-z][a-z0-9_]*$/u;
const SUPPORTED_STRENGTH_BUCKETS = new Set([
  'any',
  'inducer_variable_hyperforin',
  'moderate',
  'moderate/strong',
  'potent_inducer',
  'strong',
  'strong_inducer',
]);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function fail(message) {
  throw new Error(`invalid interaction member-set file: ${message}`);
}

function validateMemberBucket(className, strength, members) {
  const label = `classes.${className}.${strength}`;
  if (!Array.isArray(members) || members.length === 0) {
    fail(`${label} must be a non-empty array`);
  }

  const seen = new Set();
  for (const [index, member] of members.entries()) {
    if (typeof member !== 'string' || member.trim() === '') {
      fail(`${label}[${index}] must be a nonblank string`);
    }
    if (member !== member.trim()) {
      fail(`${label}[${index}] must not contain leading or trailing whitespace`);
    }
    const canonicalMember = canonicalDrug(member);
    if (seen.has(canonicalMember)) {
      fail(`${label} contains duplicate member ${JSON.stringify(member)}`);
    }
    seen.add(canonicalMember);
  }
}

export function validateInteractionMemberSets(data) {
  if (!isObject(data)) fail('root must be an object');

  for (const field of Object.keys(data)) {
    if (!TOP_LEVEL_FIELDS.has(field)) fail(`root contains unknown property ${field}`);
  }
  if (data._meta !== undefined && !isObject(data._meta)) {
    fail('_meta must be an object when present');
  }
  if (!isObject(data.classes)) fail('root must contain a classes object');

  const classes = Object.entries(data.classes);
  if (classes.length === 0) fail('classes must contain at least one class');
  for (const [className, strengthBuckets] of classes) {
    if (!CLASS_NAME_PATTERN.test(className)) {
      fail(`class name ${JSON.stringify(className)} must be lower snake_case`);
    }
    if (!isObject(strengthBuckets) || Object.keys(strengthBuckets).length === 0) {
      fail(`classes.${className} must be a non-empty object of strength buckets`);
    }
    for (const [strength, members] of Object.entries(strengthBuckets)) {
      if (!SUPPORTED_STRENGTH_BUCKETS.has(strength)) {
        fail(`classes.${className} contains unknown strength bucket ${strength}`);
      }
      validateMemberBucket(className, strength, members);
    }
  }

  return data.classes;
}

export function parseInteractionMemberSets(bytes) {
  if (!ArrayBuffer.isView(bytes) || bytes.byteLength === 0) {
    fail('bytes must be a non-empty Uint8Array');
  }

  let data;
  try {
    data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    fail(`bytes must contain valid UTF-8 JSON: ${error.message}`);
  }
  return {
    data,
    classes: validateInteractionMemberSets(data),
  };
}

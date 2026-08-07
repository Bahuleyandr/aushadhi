// Generic fail-closed validation primitives shared by the interaction
// approval draft validators. Every check throws TypeError via fail() so the
// message prefix names the artifact kind being validated; validated inputs
// are snapshotted (structuredClone + deep freeze) so hostile getters are
// read exactly once and the returned value cannot be mutated afterwards.
import { isDeepStrictEqual } from 'node:util';

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function fail(kind, message) {
  throw new TypeError(`${kind}: ${message}`);
}

function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function immutableValidatedSnapshot(value) {
  return deepFreeze(structuredClone(value));
}

export function requireObject(value, kind, label) {
  if (!isObject(value)) fail(kind, `${label} must be an object`);
  return value;
}

export function requireExactKeys(value, allowed, kind, label) {
  requireObject(value, kind, label);
  const actual = Object.keys(value);
  const unknown = actual.filter((key) => !allowed.has(key));
  const missing = [...allowed].filter((key) => !Object.hasOwn(value, key));
  if (unknown.length > 0) {
    fail(kind, `${label} contains unknown ${unknown.join(', ')}`);
  }
  if (missing.length > 0) {
    fail(kind, `${label} is missing ${missing.join(', ')}`);
  }
}

function firstDifference(actual, expected, label) {
  if (Object.is(actual, expected)) return null;
  if (Array.isArray(actual) || Array.isArray(expected)) {
    if (!Array.isArray(actual) || !Array.isArray(expected)) return label;
    if (actual.length !== expected.length) return `${label}.length`;
    for (let index = 0; index < actual.length; index += 1) {
      const difference = firstDifference(actual[index], expected[index], `${label}[${index}]`);
      if (difference !== null) return difference;
    }
    return null;
  }
  if (isObject(actual) || isObject(expected)) {
    if (!isObject(actual) || !isObject(expected)) return label;
    const keys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
    for (const key of keys) {
      if (!Object.hasOwn(actual, key) || !Object.hasOwn(expected, key)) {
        return `${label}.${key}`;
      }
      const difference = firstDifference(actual[key], expected[key], `${label}.${key}`);
      if (difference !== null) return difference;
    }
    return null;
  }
  return label;
}

export function requireExactObject(value, expected, kind, label) {
  requireExactKeys(value, new Set(Object.keys(expected)), kind, label);
  if (!isDeepStrictEqual(value, expected)) {
    const difference = firstDifference(value, expected, label);
    fail(kind, `${difference} does not match the fixed draft boundary`);
  }
}

export function requireFalse(value, kind, label) {
  if (value !== false) fail(kind, `${label} must be false`);
}

export function requireNull(value, kind, label) {
  if (value !== null) fail(kind, `${label} must remain null in a template`);
}

export function requireNonEmptyString(value, kind, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(kind, `${label} must be a non-empty string`);
  }
}

export function requireStringArray(value, kind, label, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    fail(kind, `${label} must be ${allowEmpty ? 'an' : 'a non-empty'} array`);
  }
  const seen = new Set();
  for (const item of value) {
    requireNonEmptyString(item, kind, `${label} entry`);
    if (seen.has(item)) fail(kind, `${label} contains duplicate ${item}`);
    seen.add(item);
  }
}

export function assertNoOwn(value, keys, kind, label) {
  for (const key of keys) {
    if (Object.hasOwn(value, key)) fail(kind, `${label} must not contain ${key}`);
  }
}

export function assertNoKeyRecursively(value, keys, kind, label) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => (
      assertNoKeyRecursively(entry, keys, kind, `${label}[${index}]`)
    ));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    if (keys.has(key)) fail(kind, `${label} must not contain ${key}`);
    assertNoKeyRecursively(entry, keys, kind, `${label}.${key}`);
  }
}

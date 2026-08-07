import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  strictPlainDataSnapshot,
  strictPlainDataSnapshotAllowShared,
} from '../src/lib/strict-plain-data.mjs';

// Direct unit tests pinning the EXISTING behavior of the plain-data guard
// used by the interaction libraries. These tests document the contract; they
// must not drive behavior changes to the module.

test('strictPlainDataSnapshot passes primitives through unchanged', () => {
  assert.equal(strictPlainDataSnapshot(null), null);
  assert.equal(strictPlainDataSnapshot('text'), 'text');
  assert.equal(strictPlainDataSnapshot(''), '');
  assert.equal(strictPlainDataSnapshot(true), true);
  assert.equal(strictPlainDataSnapshot(false), false);
  assert.equal(strictPlainDataSnapshot(42), 42);
  assert.equal(strictPlainDataSnapshot(-1.5), -1.5);
  assert.equal(strictPlainDataSnapshot(0), 0);
});

test('strictPlainDataSnapshot rejects non-finite numbers', () => {
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.throws(
      () => strictPlainDataSnapshot(value, 'root'),
      (error) => error instanceof TypeError && /root contains a non-finite number/.test(error.message),
    );
  }
});

test('strictPlainDataSnapshot rejects non-JSON primitives', () => {
  for (const value of [undefined, () => {}, Symbol('s'), 10n]) {
    assert.throws(
      () => strictPlainDataSnapshot(value, 'root'),
      (error) => error instanceof TypeError && /root must contain only plain JSON data/.test(error.message),
    );
  }
});

test('strictPlainDataSnapshot deep-copies, deep-freezes, and strips the object prototype', () => {
  const source = { a: 1, nested: { b: ['x', { c: null }] } };
  const snapshot = strictPlainDataSnapshot(source, 'root');

  assert.notEqual(snapshot, source);
  assert.notEqual(snapshot.nested, source.nested);
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot)), source);

  assert.equal(Object.getPrototypeOf(snapshot), null);
  assert.equal(Object.getPrototypeOf(snapshot.nested), null);
  assert.ok(Array.isArray(snapshot.nested.b));

  assert.ok(Object.isFrozen(snapshot));
  assert.ok(Object.isFrozen(snapshot.nested));
  assert.ok(Object.isFrozen(snapshot.nested.b));
  assert.ok(Object.isFrozen(snapshot.nested.b[1]));

  const descriptor = Object.getOwnPropertyDescriptor(snapshot, 'a');
  assert.equal(descriptor.writable, false);
  assert.equal(descriptor.configurable, false);
  assert.equal(descriptor.enumerable, true);

  // Later mutation of the source must not leak into the snapshot.
  source.nested.b[1].c = 'mutated';
  assert.equal(snapshot.nested.b[1].c, null);
});

test('strictPlainDataSnapshot accepts null-prototype input objects', () => {
  const source = Object.create(null);
  source.key = 'value';
  const snapshot = strictPlainDataSnapshot(source, 'root');
  assert.equal(snapshot.key, 'value');
});

test('strictPlainDataSnapshot rejects non-plain object prototypes', () => {
  class Payload { constructor() { this.a = 1; } }
  for (const value of [new Payload(), new Date(0), new Map(), /re/]) {
    assert.throws(
      () => strictPlainDataSnapshot(value, 'root'),
      (error) => error instanceof TypeError && /root must use a plain object prototype/.test(error.message),
    );
  }
});

test('strictPlainDataSnapshot rejects array subclasses and array custom properties', () => {
  class FancyArray extends Array {}
  assert.throws(
    () => strictPlainDataSnapshot(FancyArray.from([1]), 'root'),
    /root must use the ordinary Array prototype/,
  );

  const withExtra = [1, 2];
  withExtra.extra = true;
  assert.throws(
    () => strictPlainDataSnapshot(withExtra, 'root'),
    /root arrays may not contain custom properties/,
  );
});

test('strictPlainDataSnapshot rejects sparse arrays', () => {
  const sparse = [1, , 3]; // eslint-disable-line no-sparse-arrays
  assert.throws(
    () => strictPlainDataSnapshot(sparse, 'root'),
    (error) => error instanceof TypeError
      && /custom properties|enumerable data property/.test(error.message),
  );
});

test('strictPlainDataSnapshot rejects accessors, non-enumerable properties, and symbol keys', () => {
  const withGetter = {};
  Object.defineProperty(withGetter, 'evil', { get: () => 'computed', enumerable: true });
  assert.throws(
    () => strictPlainDataSnapshot(withGetter, 'root'),
    /root\.evil must be an enumerable data property; accessors and custom serialization are forbidden/,
  );

  const withHidden = { visible: 1 };
  Object.defineProperty(withHidden, 'hidden', { value: 2, enumerable: false });
  assert.throws(
    () => strictPlainDataSnapshot(withHidden, 'root'),
    /root\.hidden must be an enumerable data property/,
  );

  const withSymbol = { [Symbol('k')]: 1 };
  assert.throws(
    () => strictPlainDataSnapshot(withSymbol, 'root'),
    /root may not contain symbol properties/,
  );

  const arrayWithGetter = [];
  Object.defineProperty(arrayWithGetter, 0, { get: () => 1, enumerable: true });
  arrayWithGetter.length = 1;
  assert.throws(
    () => strictPlainDataSnapshot(arrayWithGetter, 'root'),
    /root\[0\] must be an enumerable data property/,
  );
});

test('strictPlainDataSnapshot rejects Proxy values', () => {
  const proxied = new Proxy({}, {});
  assert.throws(
    () => strictPlainDataSnapshot({ inner: proxied }, 'root'),
    /root\.inner may not contain a Proxy/,
  );
});

test('strictPlainDataSnapshot rejects cycles in both modes', () => {
  const cyclic = { name: 'a' };
  cyclic.self = cyclic;
  assert.throws(() => strictPlainDataSnapshot(cyclic, 'root'), /may not contain a cycle/);
  assert.throws(
    () => strictPlainDataSnapshotAllowShared(cyclic, 'root'),
    /may not contain a cycle/,
  );

  const deepCycle = { a: { b: [] } };
  deepCycle.a.b.push(deepCycle.a);
  assert.throws(() => strictPlainDataSnapshot(deepCycle, 'root'), /may not contain a cycle/);
});

test('shared references are rejected strictly but deduplicated when allowed', () => {
  const shared = { unit: 'mg' };
  const value = { first: shared, second: shared };

  assert.throws(
    () => strictPlainDataSnapshot(value, 'root'),
    /may not contain a shared reference/,
  );

  const snapshot = strictPlainDataSnapshotAllowShared(value, 'root');
  assert.equal(snapshot.first, snapshot.second);
  assert.equal(snapshot.first.unit, 'mg');
  assert.ok(Object.isFrozen(snapshot.first));
});

test('an own __proto__ key is preserved as data without polluting prototypes', () => {
  const source = JSON.parse('{"__proto__": {"polluted": true}, "safe": 1}');
  const snapshot = strictPlainDataSnapshot(source, 'root');

  assert.equal(Object.getPrototypeOf(snapshot), null);
  assert.equal(snapshot.safe, 1);
  const descriptor = Object.getOwnPropertyDescriptor(snapshot, '__proto__');
  assert.ok(descriptor, 'own __proto__ data property must be preserved');
  assert.equal(descriptor.value.polluted, true);
  assert.equal(({}).polluted, undefined, 'Object.prototype must not be polluted');
});

test('error labels name the exact offending path', () => {
  const value = { outer: [{ inner: NaN }] };
  assert.throws(
    () => strictPlainDataSnapshot(value, 'pack'),
    /pack\.outer\[0\]\.inner contains a non-finite number/,
  );
  // Default label is "value".
  assert.throws(() => strictPlainDataSnapshot(undefined), /^TypeError: value must contain only plain JSON data$/);
});

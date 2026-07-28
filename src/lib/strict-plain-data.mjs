import { types as utilTypes } from 'node:util';

function snapshotPlainData(value, label, state) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${label} contains a non-finite number`);
    return value;
  }
  if (typeof value !== 'object') {
    throw new TypeError(`${label} must contain only plain JSON data`);
  }
  if (utilTypes.isProxy(value)) throw new TypeError(`${label} may not contain a Proxy`);
  if (state.active.has(value)) throw new TypeError(`${label} may not contain a cycle`);
  if (state.snapshots.has(value)) {
    if (!state.allowSharedReferences) {
      throw new TypeError(`${label} may not contain a shared reference`);
    }
    return state.snapshots.get(value);
  }
  state.active.add(value);

  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      throw new TypeError(`${label} must use the ordinary Array prototype`);
    }
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes('length')) {
      throw new TypeError(`${label} arrays may not contain custom properties`);
    }
    const snapshot = [];
    state.snapshots.set(value, snapshot);
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !('value' in descriptor) || descriptor.enumerable !== true) {
        throw new TypeError(`${label}[${index}] must be an enumerable data property`);
      }
      snapshot.push(snapshotPlainData(descriptor.value, `${label}[${index}]`, state));
    }
    state.active.delete(value);
    return Object.freeze(snapshot);
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must use a plain object prototype`);
  }
  const snapshot = Object.create(null);
  state.snapshots.set(value, snapshot);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') throw new TypeError(`${label} may not contain symbol properties`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor) || descriptor.enumerable !== true) {
      throw new TypeError(
        `${label}.${key} must be an enumerable data property; accessors and custom serialization are forbidden`,
      );
    }
    Object.defineProperty(snapshot, key, {
      value: snapshotPlainData(descriptor.value, `${label}.${key}`, state),
      enumerable: true,
      writable: false,
      configurable: false,
    });
  }
  state.active.delete(value);
  return Object.freeze(snapshot);
}

export function strictPlainDataSnapshot(value, label = 'value') {
  return snapshotPlainData(value, label, {
    active: new Set(),
    snapshots: new Map(),
    allowSharedReferences: false,
  });
}

export function strictPlainDataSnapshotAllowShared(value, label = 'value') {
  return snapshotPlainData(value, label, {
    active: new Set(),
    snapshots: new Map(),
    allowSharedReferences: true,
  });
}

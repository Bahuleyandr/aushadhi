import { types as utilTypes } from 'node:util';

export function strictPlainDataSnapshot(value, label = 'value', seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${label} contains a non-finite number`);
    return value;
  }
  if (typeof value !== 'object') {
    throw new TypeError(`${label} must contain only plain JSON data`);
  }
  if (utilTypes.isProxy(value)) throw new TypeError(`${label} may not contain a Proxy`);
  if (seen.has(value)) throw new TypeError(`${label} may not contain a cycle or shared reference`);
  seen.add(value);

  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      throw new TypeError(`${label} must use the ordinary Array prototype`);
    }
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes('length')) {
      throw new TypeError(`${label} arrays may not contain custom properties`);
    }
    const snapshot = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !('value' in descriptor) || descriptor.enumerable !== true) {
        throw new TypeError(`${label}[${index}] must be an enumerable data property`);
      }
      snapshot.push(strictPlainDataSnapshot(descriptor.value, `${label}[${index}]`, seen));
    }
    return Object.freeze(snapshot);
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must use a plain object prototype`);
  }
  const snapshot = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') throw new TypeError(`${label} may not contain symbol properties`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor) || descriptor.enumerable !== true) {
      throw new TypeError(
        `${label}.${key} must be an enumerable data property; accessors and custom serialization are forbidden`,
      );
    }
    Object.defineProperty(snapshot, key, {
      value: strictPlainDataSnapshot(descriptor.value, `${label}.${key}`, seen),
      enumerable: true,
      writable: false,
      configurable: false,
    });
  }
  return Object.freeze(snapshot);
}

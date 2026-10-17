// src/core/hash.js - owns canonical FNV-1a state hashing in little-endian byte order.
const OFFSET = 0x811c9dc5;
const PRIME = 0x01000193;
/** FNV-1a over raw bytes. Optional seed supports incremental hashing. */
export function fnv1a(bytes, seed = OFFSET) {
  let h = seed >>> 0;
  for (const byte of bytes) h = Math.imul(h ^ byte, PRIME) >>> 0;
  return h;
}
/** Canonical structural hash; entity arrays are sorted by id without mutating state.
 * A top-level Uint8Array is raw bytes, permitting standard FNV test vectors.
 * Other typed arrays encode each numeric element little-endian, independent of host endian.
 */
export function hash(value, seed = OFFSET) {
  let h = seed >>> 0;
  const scratch = new DataView(new ArrayBuffer(8));
  const byte = n => { h = Math.imul(h ^ n, PRIME) >>> 0; };
  const number = n => { scratch.setFloat64(0, Object.is(n, -0) ? 0 : n, true); for (let i = 0; i < 8; i++) byte(scratch.getUint8(i)); };
  const string = s => { number(s.length); for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); byte(c & 255); byte(c >>> 8); } };
  function visit(v) {
    if (v === null) { byte(0); return; }
    if (ArrayBuffer.isView(v)) {
      byte(1); string(v.constructor.name); number(v.length ?? v.byteLength);
      if (v instanceof DataView) { for (let i = 0; i < v.byteLength; i++) byte(v.getUint8(i)); }
      else if (v.BYTES_PER_ELEMENT === 1) { for (const n of v) byte(n & 255); }
      else {
        const setters = { Uint16Array: 'setUint16', Int16Array: 'setInt16', Uint32Array: 'setUint32', Int32Array: 'setInt32', Float32Array: 'setFloat32', Float64Array: 'setFloat64', BigInt64Array: 'setBigInt64', BigUint64Array: 'setBigUint64' };
        const setter = setters[v.constructor.name];
        if (!setter) throw new TypeError('Unsupported typed array');
        for (const n of v) { scratch[setter](0, n, true); for (let i = 0; i < v.BYTES_PER_ELEMENT; i++) byte(scratch.getUint8(i)); }
      }
    } else if (Array.isArray(v)) {
      byte(2); number(v.length);
      const values = v.length && v.every(e => e && typeof e === 'object' && 'id' in e) ? [...v].sort(compareId) : v;
      for (const e of values) visit(e);
    } else if (typeof v === 'object') {
      byte(3);
      const keys = Object.keys(v).filter(k => typeof v[k] !== 'function').sort();
      number(keys.length);
      for (const k of keys) { string(k); visit(v[k]); }
    } else if (typeof v === 'number') { byte(4); number(v); }
    else if (typeof v === 'string') { byte(5); string(v); }
    else if (typeof v === 'boolean') { byte(v ? 6 : 7); }
    else if (typeof v === 'undefined') { byte(8); }
    else throw new TypeError(`Unsupported hash value: ${typeof v}`);
  }
  if (value instanceof Uint8Array) return fnv1a(value, h);
  visit(value);
  return h;
}
/** Stable comparison for numeric or string entity ids. */
export function compareId(a, b) { return typeof a.id === 'number' && typeof b.id === 'number' ? a.id - b.id : String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0; }
/** Eight hexadecimal digits for save files and replay diagnostics. */
export function hashHex(value) { return hash(value).toString(16).padStart(8, '0'); }

// src/core/rng.js - owns seeded sfc32 random streams and independent named forks.
import { hash } from './hash.js';
const UINT_RANGE = 4294967296;
/** Splitmix32 seed expander. Each call returns an unsigned word. */
export function splitmix32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x9e3779b9) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    return (z ^ (z >>> 15)) >>> 0;
  };
}
/** Small-fast-counter PRNG with explicit save/restore, returning U[0,1). */
export function sfc32(a, b, c, d) {
  const next = () => {
    const word = ((a + b | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = ((c << 21) | (c >>> 11));
    c = (c + word) | 0;
    return word >>> 0;
  };
  const rng = () => next() / UINT_RANGE;
  rng.uint32 = next;
  rng.snapshot = () => [a >>> 0, b >>> 0, c >>> 0, d >>> 0];
  rng.restore = words => {
    if (!Array.isArray(words) || words.length !== 4 || words.some(n => !Number.isInteger(n) || n < 0 || n >= UINT_RANGE)) throw new TypeError('Invalid sfc32 state');
    [a, b, c, d] = words;
  };
  return rng;
}
/** Create a replayable stream. Forks derive from the initial seed, never its draw position. */
export function createRng(seed = 0) {
  const key = typeof seed === 'number' ? seed >>> 0 : hash(String(seed));
  const mix = splitmix32(key), rng = sfc32(mix(), mix(), mix(), mix());
  for (let i = 0; i < 12; i++) rng();
  rng.fork = name => createRng(hash([key, String(name)]));
  rng.next = rng;
  return rng;
}
/** Lazily allocate independent map/wind/scatter/npc/ai/fire streams. */
export function createStreams(seed = 0) {
  const root = createRng(seed), streams = new Map();
  return {
    get(name) { if (!streams.has(name)) streams.set(name, root.fork(name)); return streams.get(name); },
    snapshot() { return Object.fromEntries([...streams].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([name, rng]) => [name, rng.snapshot()])); },
    restore(saved) { streams.clear(); for (const name of Object.keys(saved).sort()) { const rng = root.fork(name); rng.restore(saved[name]); streams.set(name, rng); } },
  };
}

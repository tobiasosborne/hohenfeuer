// tests/unit/sim-core.test.js - owns deterministic core and loop acceptance fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as f from '../../src/core/fmath.js';
import { createRng, createStreams } from '../../src/core/rng.js';
import { hash, hashHex } from '../../src/core/hash.js';
import { createLoop } from '../../src/core/loop.js';

test('fmath agrees with reference values over the simulation domain', () => {
  for (let i = -720; i <= 720; i += 7) {
    const x = i / 57;
    assert.ok(Math.abs(f.sin(x) - Math.sin(x)) < 2e-13);
    assert.ok(Math.abs(f.cos(x) - Math.cos(x)) < 2e-13);
    assert.ok(Math.abs(f.atan2(f.sin(x), f.cos(x)) - Math.atan2(Math.sin(x), Math.cos(x))) < 2e-13);
  }
  for (const x of [1e-300, 0.001, 0.5, 1, 2, 10, 100, 1e300]) {
    assert.ok(Math.abs(f.sqrt(x) / Math.sqrt(x) - 1) < 3e-15);
    assert.ok(Math.abs(f.log(x) - Math.log(x)) < 2e-12);
  }
  for (const x of [-700, -10, -0.1, 0, 0.1, 10, 700]) assert.ok(Math.abs(f.exp(x) / Math.exp(x) - 1) < 1e-12);
  assert.ok(Math.abs(f.pow(3, 2.5) - Math.pow(3, 2.5)) < 1e-12);
  assert.equal(f.sqrt(0), 0);
  assert.ok(Number.isNaN(f.sqrt(-1)));
  assert.equal(f.atan2(0, -1), f.PI);
});

test('seeded streams replay, fork independently, and restore state', () => {
  const a = createStreams(42), b = createStreams(42);
  assert.deepEqual(Array.from({ length: 1000 }, () => a.get('wind')()), Array.from({ length: 1000 }, () => b.get('wind')()));
  a.get('scatter')();
  assert.equal(a.get('npc')(), b.get('npc')());
  const rng = createRng('duel');
  const child = rng.fork('map');
  rng(); rng();
  assert.equal(child(), rng.fork('map')());
  const saved = rng.snapshot(), expected = rng();
  rng.restore(saved);
  assert.equal(rng(), expected);
  assert.ok(expected >= 0 && expected < 1);
});

test('canonical FNV hashes typed bytes, object keys and entities in id order', () => {
  assert.equal(hash(new Uint8Array([104, 101, 108, 108, 111])), 0x4f9f2cab);
  assert.equal(hash({ b: 2, a: 1 }), hash({ a: 1, b: 2 }));
  assert.equal(hash([{ id: 2, x: 3 }, { id: 1, x: 4 }]), hash([{ id: 1, x: 4 }, { id: 2, x: 3 }]));
  assert.notEqual(hash({ a: 1 }), hash({ a: 2 }));
  assert.notEqual(hash(new Uint16Array([256])), hash(new Uint16Array([1])));
  assert.match(hashHex({ seed: 42 }), /^[0-9a-f]{8}$/);
});

test('fixed-step loop clamps elapsed time, caps work and pauses visibility', () => {
  let ticks = 0;
  const loop = createLoop({ tick: () => ticks++, dt: 1 / 30, maxFrameDt: 0.25, maxTicks: 5 });
  assert.equal(loop.advance(1 / 60).ticks, 0);
  assert.equal(loop.advance(1 / 60).ticks, 1);
  assert.equal(ticks, 1);
  assert.equal(loop.advance(3).ticks, 5);
  assert.ok(loop.alpha >= 0 && loop.alpha < 1);
  loop.setVisible(false);
  assert.equal(loop.advance(10).ticks, 0);
  loop.setVisible(true);
  assert.equal(loop.advance(1 / 30).ticks, 1);
  assert.equal(loop.advance(-1).ticks, 0);
});

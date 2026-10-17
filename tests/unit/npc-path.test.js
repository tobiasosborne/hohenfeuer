// tests/unit/npc-path.test.js - owns navigation acceptance fixtures for DESIGN 4.4.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BLOCK, FACING } from '../../src/contracts.js';
import { findPath, isStandable, neighbors, createPathCache } from '../../src/npc/path.js';
import { fixture } from './npc-fixture.test.js';

test('standability requires two clear cells, excludes roofs, and passes paired doors', () => {
  const f = fixture();
  assert.ok(isStandable(f.plot, [2, 1, 2]));
  f.put(2, 2, 2, BLOCK.STONE);
  assert.equal(isStandable(f.plot, [2, 1, 2]), false);
  f.put(2, 2, 2, BLOCK.AIR); f.put(2, 0, 2, BLOCK.ROOF); // foundation intentionally immutable
  f.put(3, 1, 2, BLOCK.ROOF);
  assert.equal(isStandable(f.plot, [3, 2, 2]), false);
  f.put(4, 1, 2, BLOCK.DOOR); f.put(4, 2, 2, BLOCK.DOOR);
  assert.ok(isStandable(f.plot, [4, 1, 2]));
  assert.equal(neighbors(f.plot, [3, 1, 3]).some(n => n.cell[0] === 4 && n.cell[2] === 2), false);
});

test('stairs ascend along facing and descend in reverse; ordinary blocks cannot be jumped', () => {
  const f = fixture({ depth: 3 });
  f.put(2, 1, 1, BLOCK.STAIRS, undefined, FACING.E);
  f.put(3, 1, 1, BLOCK.STONE);
  const path = findPath(f.plot, [1, 1, 1], [3, 2, 1]);
  assert.deepEqual(path, [[1, 1, 1], [2, 1, 1], [3, 2, 1]]);
  assert.deepEqual(findPath(f.plot, [3, 2, 1], [1, 1, 1]), [...path].reverse());
  f.put(2, 1, 1, BLOCK.STONE);
  assert.equal(findPath(f.plot, [1, 1, 1], [3, 2, 1]), null);
});

test('ladder column permits vertical travel and platform exit with 2 m clearance', () => {
  const f = fixture({ depth: 3 });
  for (let y = 1; y <= 3; y++) f.put(2, y, 1, BLOCK.LADDER);
  f.put(3, 2, 1, BLOCK.STONE);
  const p = findPath(f.plot, [1, 1, 1], [3, 3, 1]);
  assert.ok(p.some(c => c[0] === 2 && c[1] === 2));
  assert.deepEqual(p.at(-1), [3, 3, 1]);
  f.put(2, 3, 1, BLOCK.STONE);
  assert.equal(findPath(f.plot, [1, 1, 1], [3, 3, 1]), null);
});

test('step down is one cell, moves never diagonal, deterministic f/h/index tie-break', () => {
  const f = fixture(); f.put(2, 1, 2, BLOCK.STONE);
  assert.ok(neighbors(f.plot, [2, 2, 2]).some(n => n.cell.join() === '3,1,2'));
  f.put(2, 2, 2, BLOCK.STONE);
  assert.equal(neighbors(f.plot, [2, 3, 2]).some(n => n.cell.join() === '3,1,2'), false);
  const p = findPath(f.plot, [5, 1, 3], [7, 1, 5]);
  assert.deepEqual(p.slice(0, 3), [[5, 1, 3], [6, 1, 3], [7, 1, 3]]);
  for (let i = 1; i < p.length; i++) assert.equal(Math.abs(p[i][0] - p[i - 1][0]) + Math.abs(p[i][2] - p[i - 1][2]), 1);
  assert.deepEqual(findPath(f.plot, p[0], p.at(-1)), p);
});

test('versioned cache invalidates successful and unsuccessful paths on block changes', () => {
  const f = fixture({ width: 5, depth: 1 }); const cache = createPathCache();
  assert.equal(cache.find(f.plot, [0, 1, 0], [4, 1, 0]).length, 5);
  f.put(2, 1, 0, BLOCK.STONE);
  assert.equal(cache.find(f.plot, [0, 1, 0], [4, 1, 0]), null);
  f.put(2, 1, 0, BLOCK.AIR);
  assert.equal(cache.find(f.plot, [0, 1, 0], [4, 1, 0]).length, 5);
  assert.equal(findPath(f.plot, [0, 1, 0], [4, 1, 0], { maxExpansions: 1 }), null);
});

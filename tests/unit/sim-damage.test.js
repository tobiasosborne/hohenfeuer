// tests/unit/sim-damage.test.js - owns blast ordering, capsule hits and elimination fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyBlast, segmentCapsule, segmentAabb } from '../../src/sim/damage.js';
import { checkRules } from '../../src/sim/rules.js';
import { tickEconomy } from '../../src/sim/economy.js';
import { createPlot, setCell, getCell, cellIndex } from '../../src/world/grid.js';
import { TUNING as T } from '../../src/tuning.js';
import * as C from '../../src/contracts.js';

test('TB2: direct target excludes splash, collateral rounds upward, foundation survives', () => {
  const plot = createPlot({ width: 8, height: 8, depth: 8 });
  const cells = [[3, 2, 3], [4, 2, 3], [5, 2, 3]];
  for (const p of cells) setCell(plot, ...p, C.BLOCK.STONE, T.blocks.stone.hp);
  const events = [], context = { state: { tick: 0, castles: [{ id: 0, plot }], weapons: [], rulers: [], npcs: [] }, emit: (type, data) => events.push({ type, ...data }), getBlock: () => ({ hp: T.blocks.stone.hp }) };
  const result = applyBlast(context, { pos: { x: 3.5, y: 2.5, z: 3.5 }, hit: { plot, index: cellIndex(plot, ...cells[0]) }, direct: 16, splash: 20, radius: 1.25, sourceSlot: 1 });
  assert.equal(getCell(plot, ...cells[0]).hp, 24);
  assert.equal(getCell(plot, ...cells[1]).hp, 36);
  assert.equal(getCell(plot, ...cells[2]).hp, 40);
  assert.deepEqual(result.cells.map(c => c.index), [...result.cells.map(c => c.index)].sort((a, b) => a - b));
  applyBlast(context, { pos: { x: 3.5, y: 0.5, z: 3.5 }, hit: { plot, index: cellIndex(plot, 3, 0, 3) }, direct: 1000, splash: 1000, radius: 1.25, sourceSlot: 1 });
  assert.equal(getCell(plot, 3, 0, 3).hp, T.hpIndestructible);
});

test('segment capsule and AABB return earliest fractions including endpoint caps', () => {
  const person = { pos: { x: 4, y: 1, z: 2 }, radius: T.people.rulerRadius, height: T.people.height };
  assert.ok(segmentCapsule({ x: 0, y: 2, z: 2 }, { x: 8, y: 2, z: 2 }, person) < 0.5);
  assert.equal(segmentCapsule({ x: 0, y: 4, z: 2 }, { x: 8, y: 4, z: 2 }, person), null);
  assert.ok(segmentCapsule({ x: 4, y: 4, z: 2 }, { x: 4, y: 0, z: 2 }, person) < 0.5);
  assert.equal(segmentAabb({ x: 0, y: 1, z: 1 }, { x: 10, y: 1, z: 1 }, { min: { x: 4, y: 0, z: 0 }, max: { x: 5, y: 2, z: 2 } }), 0.4);
});

test('palace below 30%, ruler death, surrender and simultaneous draw resolve in order', () => {
  const make = (id, hp, rulerHp = 100) => { const plot = createPlot({ width: 3, height: 4, depth: 3 }); setCell(plot, 1, 1, 1, C.BLOCK.PALACE, hp); return { id, slot: id, plot, palaceCells: [cellIndex(plot, 1, 1, 1)], initialPalaceHp: 40, eliminated: false, morale: 70, population: 0, initialPopulation: 0, surrenderTicks: 0, stats: {} }; };
  const state = { tick: 0, castles: [make(0, 11), make(1, 40)], rulers: [{ slot: 0, hp: 0 }, { slot: 1, hp: 100 }], slots: [{ id: 0, team: 0 }, { id: 1, team: 1 }], outcome: null };
  checkRules({ state, emit() {} });
  assert.equal(state.castles[0].reason, C.ELIM.PALACE);
  assert.deepEqual(state.outcome.winners, [1]);
  state.castles = [make(0, 11), make(1, 11)]; state.outcome = null;
  checkRules({ state, emit() {} });
  assert.equal(state.outcome.draw, true);
});

test('economy applies palace and civilian income and caps gold', () => {
  const castle = { gold: T.economy.goldCap - 0.1, eliminated: false, civiliansWorking: 12, magazines: [] };
  tickEconomy({ state: { castles: [castle] } });
  assert.equal(castle.gold, T.economy.goldCap);
});

test('replacing an original palace cell with stone does not restore palace integrity', () => {
  const plot = createPlot({ width: 3, height: 3, depth: 3 });
  setCell(plot, 1, 1, 1, C.BLOCK.STONE, T.blocks.stone.hp);
  const castle = { id: 0, slot: 0, plot, palaceCells: [cellIndex(plot, 1, 1, 1)], initialPalaceHp: T.blocks.palace.hp, population: 0, initialPopulation: 0, morale: T.morale.start };
  checkRules({ state: { tick: 0, castles: [castle], rulers: [{ slot: 0, hp: T.people.hp }], slots: [{ id: 0, team: 0 }], outcome: null }, emit() {} });
  assert.equal(castle.reason, C.ELIM.PALACE);
});

// tests/unit/ai-accuracy.test.js - owns Phase 1 acceptance 8 over production-ballistics feedback.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAiController } from '../../src/ai/controller.js';
import { createSlotTable } from '../../src/ai/slots.js';
import { buildRangeTable, dialToElevation, traceFlight } from '../../src/sim/ballistics.js';
import { createRng } from '../../src/core/rng.js';
import { BLOCK, CMD, EV, RNG_STREAM } from '../../src/contracts.js';
import { TUNING as T } from '../../src/tuning.js';

/** Mock read-only SimView; only own feedback is updated by the external analytic harness. */
function shots(level, seed, count) {
  const slots = createSlotTable({ slots: [{ castle: 'keep' }, { castle: 'keep' }] }, { aiLevel: level });
  const plot = origin => ({ width: 1, depth: 1, height: 3, origin, type: new Uint8Array([0, BLOCK.PALACE, 0]), hp: new Uint8Array([0, 40, 0]), meta: new Uint8Array(3) });
  const distance = T.ai.hitTest.distanceM;
  const weapon = { id: 0, slot: 0, defId: 'cannon', hp: T.weapons.cannon.hp, pos: [0.5, 1.5, 0.5], loaded: false };
  weapon.muzzle = weapon.pos;
  const target = [0.5, 1.5, 0.5 - distance];
  const view = { tick: 0, slots, castles: [{ slot: 0, gold: T.economy.goldCap, plot: plot([0, 0, 0]) },
    { slot: 1, gold: 0, plot: plot([0, 0, -distance]) }], weapons: [weapon], rulers: [], wind: { x: 0, z: 0 }, events: [],
    commandKinds: [CMD.AIM, CMD.FIRE] };
  const controller = createAiController(), rng = createRng(seed).fork(`${RNG_STREAM.AI}:0`), table = buildRangeTable(T.weapons.cannon);
  let aim, hits = 0, firstHit = Infinity;
  for (let shot = 0; shot < count; shot++) {
    weapon.loaded = false;
    let output = controller.think(view, slots[0], rng);
    for (const command of output) if (command.type === CMD.AIM) aim = command;
    view.tick += T.sim.aiThinkEveryTicks; weapon.loaded = true;
    for (let guard = 0; guard < 20; guard++) {
      output = controller.think(view, slots[0], rng);
      for (const command of output) if (command.type === CMD.AIM) aim = command;
      view.tick += T.sim.aiThinkEveryTicks;
      if (output.some(c => c.type === CMD.FIRE)) break;
      assert.ok(guard < 19, 'AI eventually fires every loaded shot');
    }
    // Analytic harness: production range-table inverse and exact production trajectory,
    // no collisions, scatter or wind, interpolated at target height.
    const impact = traceFlight({ ...T.weapons.cannon, pos: { x: 0.5, y: 1.5, z: 0.5 },
      charge: aim.range / T.aim.rangeUnitsPerDial, elevation: dialToElevation(table, aim.range / T.aim.rangeUnitsPerDial), azimuth: aim.az / T.aim.azUnitsPerDeg }).pos;
    const hit = Math.abs(impact.x - target[0]) <= T.ai.hitTest.targetM / 2 && Math.abs(impact.z - target[2]) <= T.ai.hitTest.targetM / 2;
    if (hit) { hits++; firstHit = Math.min(firstHit, shot + 1); }
    view.events = [{ type: EV.IMPACT, tick: view.tick - 1, payload: { slot: 0, weaponId: 0, pos: [impact.x, impact.y, impact.z] } }];
  }
  return { hits, firstHit, count };
}

test('level 10 hits a 3m static target at 192m within six shots, median 20 seeds / 200 shots', t => {
  const results = Array.from({ length: T.ai.hitTest.seeds }, (_, i) => shots(10, i + 1, 10));
  const times = results.map(r => r.firstHit).sort((a, b) => a - b), total = results.reduce((n, r) => n + r.hits, 0);
  const median = (times[9] + times[10]) / 2;
  t.diagnostic(`level 10: ${total}/200 hits; median first hit ${median}; first-hit shots ${times.join(',')}`);
  assert.equal(results.reduce((n, r) => n + r.count, 0), 200);
  assert.ok(median <= T.ai.hitTest.level10Shots);
  assert.ok(total > 100, 'majority of all 200 shots hit');
  assert.deepEqual(shots(10, 1, 10), shots(10, 1, 10));
});

test('level 1 misses the target through 20 shots for the median of the same 20 seeds', t => {
  const results = Array.from({ length: T.ai.hitTest.seeds }, (_, i) => shots(1, i + 1, T.ai.hitTest.level1Shots));
  const misses = results.filter(r => r.firstHit > T.ai.hitTest.level1Shots).length;
  t.diagnostic(`level 1: ${results.reduce((n, r) => n + r.hits, 0)}/400 hits; ${misses}/20 seeds never hit within 20 shots`);
  assert.ok(misses > T.ai.hitTest.seeds / 2);
});

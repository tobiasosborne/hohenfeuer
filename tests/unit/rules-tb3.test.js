// tests/unit/rules-tb3.test.js - owns the headless ruler-to-mason tracer bullet and its deterministic economy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { freezeRegistries, resetRegistriesForTests, BLOCK, EV, K } from '../../src/contracts.js';
import { registerCoreSim } from '../../src/plugins/index.sim.js';
import { createSim } from '../../src/sim/sim.js';
import { TUNING as T } from '../../src/tuning.js';
import { TB3, createTb3Script } from '../../src/tb3-script.js';
import { reservedGold } from '../../src/sim/economy.js';

function run() {
  resetRegistriesForTests(); registerCoreSim(); freezeRegistries();
  const script = createTb3Script(), sim = createSim({ map: 'forest-duel', seed: 1 });
  let income = 0;
  const events = [], initialGold = sim.state.castles[0].gold;
  for (let tick = 0; tick < TB3.maxBuildTicks; tick++) {
    const state = sim.state;
    sim.tick(script.next(state));
    const next = sim.state;
    income += (T.economy.palaceIncomeS + T.economy.civilianIncomeS * next.castles[0].civiliansWorking) * K.DT;
    events.push(...sim.drainEvents());
    if (TB3.cells.every(([x, y, z]) => next.castles[0].plot.type[x + 48 * z + 2304 * y] === BLOCK.STONE)) break;
  }
  const s = sim.state, built = events.filter(e => e.type === EV.BLOCK_BUILT && e.payload.plot === 0);
  assert.equal(built.length, 5);
  assert.ok(s.tick < TB3.maxBuildTicks);
  assert.equal(s.rulers[0].manning, null);
  assert.ok(s.rulers[0].pos.y >= 7, 'ruler designates from the rampart');
  assert.equal(reservedGold(s.castles[0]), 0);
  assert.ok(Math.abs(s.castles[0].gold - (initialGold + income - TB3.cells.length * T.blocks.stone.cost)) < 1e-7, 'only the five block costs were spent');
  return { hash: sim.hash(), tick: s.tick, gold: s.castles[0].gold, built: built.map(e => e.payload.cell) };
}

test('TB3: ruler designates five rampart blocks; masons finish within the tick bound with exact cost, twice', t => {
  const a = run(), b = run(); assert.deepEqual(a, b); t.diagnostic(JSON.stringify(a));
});

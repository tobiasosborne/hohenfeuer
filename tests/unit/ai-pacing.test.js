// tests/unit/ai-pacing.test.js - owns TB2 level-five duel duration and one-shot keep survival acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../src/contracts.js';
import { TUNING as T } from '../../src/tuning.js';
import { registerCoreSim } from '../../src/plugins/index.sim.js';
import { createSim } from '../../src/sim/sim.js';
import { createSlotTable } from '../../src/ai/slots.js';
import { createTb1Script } from '../../src/tb1-script.js';
import { palaceIntegrity } from '../../src/sim/rules.js';

function content() { C.resetRegistriesForTests(); registerCoreSim(); C.freezeRegistries(); }

test('one scripted palace shot cannot flatten a protected keep', t => {
  content();
  const sim = createSim({ map: 'forest-duel', seed: 1 }), script = createTb1Script();
  let impacts = 0;
  for (let tick = 0; tick < 20 * T.sim.tickHz && !impacts; tick++) {
    sim.tick(script.next(sim.state));
    impacts += sim.drainEvents().filter(e => e.type === C.EV.IMPACT && e.payload.slot === 0).length;
  }
  assert.equal(impacts, 1);
  const enemy = sim.state.castles[1], integrity = palaceIntegrity(enemy);
  const destroyed = enemy.palaceCells.filter(i => enemy.plot.type[i] !== C.BLOCK.PALACE).length;
  t.diagnostic(`first shot: palace integrity ${integrity}, ${destroyed}/${enemy.palaceCells.length} palace cells destroyed`);
  assert.ok(integrity >= 0.9, 'curtain wall protects the 48-cell palace from one blast');
  assert.equal(sim.state.outcome, null);
});

for (const seed of [1, 2, 3]) test(`level 5 forest-duel seed ${seed} ends with a winner in 8-20 sim minutes`, t => {
  content();
  const slots = createSlotTable(C.getMap('forest-duel'), { aiLevel: 5, aiTactic: C.TACTIC.GENERAL });
  const sim = createSim({ map: 'forest-duel', seed, slots });
  let state;
  for (let tick = 0; tick < 20 * 60 * T.sim.tickHz; tick++) {
    sim.tick([]);
    if (tick % T.sim.tickHz === 0) {
      sim.drainEvents(); state = sim.state;
      if (state.outcome) break;
    }
  }
  state = sim.state;
  const result = { seed, ticks: state.tick, seconds: state.tick / T.sim.tickHz, winner: state.outcome?.winners,
    reason: state.castles.filter(c => c.eliminated).map(c => c.reason), shots: state.castles.map(c => c.stats.shots), hash: sim.hash() };
  t.diagnostic(JSON.stringify(result));
  assert.ok(state.outcome, 'duel must finish before 20 sim minutes');
  assert.equal(state.outcome.draw, false);
  assert.equal(state.outcome.winners.length, 1);
  assert.ok(state.tick >= 8 * 60 * T.sim.tickHz, `duel ended too soon: ${result.seconds}s`);
  assert.ok(state.tick <= 20 * 60 * T.sim.tickHz);
});

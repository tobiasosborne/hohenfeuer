// tests/unit/ai-tb3-match.test.js - owns full-rule rebuild pacing and deterministic AI-vs-AI replay acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../src/contracts.js';
import { TUNING as T } from '../../src/tuning.js';
import { registerCoreSim } from '../../src/plugins/index.sim.js';
import { createSim } from '../../src/sim/sim.js';
import { createSlotTable } from '../../src/ai/slots.js';

test('TB3: AI duel with real paid rebuilds ends in 8-20 minutes and all replay checkpoint hashes agree', t => {
  C.resetRegistriesForTests(); registerCoreSim(); C.freezeRegistries();
  const slots = createSlotTable(C.getMap('forest-duel'), { aiLevel: T.ai.defaultLevel, aiTactic: C.TACTIC.GENERAL });
  function run() {
    const sim = createSim({ map: 'forest-duel', seed: 1, slots }), hashes = [];
    let state, designated = 0, built = 0;
    for (let tick = 0; tick < 20 * 60 * T.sim.tickHz; tick++) {
      sim.tick();
      if (tick % T.sim.tickHz === 0) {
        const events = sim.drainEvents();
        designated += events.filter(e => e.type === C.EV.DESIGNATION_ADDED).length;
        built += events.filter(e => e.type === C.EV.BLOCK_BUILT).length;
        state = sim.state;
        if (tick % (10 * T.sim.tickHz) === 0) hashes.push(sim.hash());
        if (state.outcome) break;
      }
    }
    assert.ok(state.outcome && !state.outcome.draw);
    assert.ok(state.tick >= 8 * 60 * T.sim.tickHz && state.tick <= 20 * 60 * T.sim.tickHz, `duration ${state.tick / T.sim.tickHz}s`);
    assert.ok(designated > 0 && built > 0, `paid rebuilds: ${designated} designated, ${built} built`);
    return { tick: state.tick, hash: sim.hash(), winner: state.outcome.winners, designated, built, hashes };
  }
  const a = run(); assert.deepEqual(run(), a);
  t.diagnostic(JSON.stringify({ ...a, hashes: `${a.hashes.length} identical checkpoints`, seconds: a.tick / T.sim.tickHz }));
});

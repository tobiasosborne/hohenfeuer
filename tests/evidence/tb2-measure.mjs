// tests/evidence/tb2-measure.mjs - owns repeatable headless duel measurements for TB2 tuning.
import * as C from '../../src/contracts.js';
import { registerCoreSim } from '../../src/plugins/index.sim.js';
import { createSim } from '../../src/sim/sim.js';
import { createSlotTable } from '../../src/ai/slots.js';
import { palaceIntegrity } from '../../src/sim/rules.js';
import { TUNING as T } from '../../src/tuning.js';
C.resetRegistriesForTests(); registerCoreSim(); C.freezeRegistries();
const seed = Number(process.argv[2] ?? 1), level = Number(process.argv[3] ?? 5);
const slots = createSlotTable(C.getMap('forest-duel'), { aiLevel: level, aiTactic: C.TACTIC.GENERAL });
const sim = createSim({ map: 'forest-duel', seed, slots });
let state;
for (let tick = 0; tick < 20 * 60 * T.sim.tickHz; tick++) {
  sim.tick([]);
  if (tick % T.sim.tickHz !== 0) continue;
  sim.drainEvents(); state = sim.state;
  if (tick % (60 * T.sim.tickHz) === 0 || state.outcome) {
    console.log(JSON.stringify({ seed, level, tick: state.tick, seconds: state.tick / T.sim.tickHz,
      shots: state.castles.map(c => c.stats.shots), palace: state.castles.map(palaceIntegrity),
      rulers: state.rulers.map(r => r.hp), weapons: state.weapons.map(w => [w.hp, w.ammo, w.crewPresent]),
      damage: state.castles.map(c => c.stats.damageDp), jobs: state.castles.map(c => c.jobs?.length),
      targets: JSON.parse(new TextDecoder('utf-16le').decode(sim.serialize())).ai.slots.map(s => s.weapons.map(w => [w.id, w.target?.kind, w.target?.pos, w.aim?.observations])),
      outcome: state.outcome, eliminated: state.castles.filter(c => c.eliminated).map(c => [c.slot, c.reason]) }));
  }
  if (state.outcome) break;
}
console.log(JSON.stringify({ hash: sim.hash(), tick: sim.state.tick }));

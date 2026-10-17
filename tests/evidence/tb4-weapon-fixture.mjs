// tests/evidence/tb4-weapon-fixture.mjs - owns isolated production-sim fixtures for weapon acceptance.
import * as C from '../../src/contracts.js';
import { registerCoreSim } from '../../src/plugins/index.sim.js';
import { registerCoreView } from '../../src/plugins/index.view.js';
import { createSim } from '../../src/sim/sim.js';
import { createWeapon } from '../../src/sim/weapons.js';
import { createWind } from '../../src/sim/wind.js';
import { setCell } from '../../src/world/grid.js';
export const IDS = ['catapult', 'cannon', 'double-cannon', 'fire-catapult', 'ballista', 'rocket', 'trebuchet', 'arcaballista', 'fat-freda', 'hellfire'];
export function content() { C.resetRegistriesForTests(); registerCoreSim(); registerCoreView(); C.freezeRegistries(); }
export function fixture(id, { charge = 100, seed = 17 } = {}) {
  let api;
  const sim = createSim({ map: 'forest-duel', seed, hooks: {
    npcTick() {}, npcKinematics() {}, moraleTick() {},
    onReady(a) {
      api = a; const s = a.state;
      s.wind = createWind({ seed: 1, strength: 0, change: 0 });
      s.terrain.heights.fill(0); s.terrain.baseHeights.fill(0);
      s.npcs = [];
      for (const c of s.castles) {
        c.plot.type.fill(0); c.plot.hp.fill(0); c.plot.meta.fill(0);
        for (let z = 0; z < 48; z++) for (let x = 0; x < 48; x++) setCell(c.plot, x, 0, z, C.BLOCK.FOUNDATION, 255);
        c.initialPalaceHp = 0; c.population = c.initialPopulation = 0; c.gold = 1500;
        const r = s.rulers.find(r => r.slot === c.slot);
        r.pos = { x: c.plot.origin.x + 2.5, y: 1, z: c.plot.origin.z + 2.5 };
      }
      s.weapons = [createWeapon(C.getWeapon(id), { id: 0, slot: 0, pos: { x: 80, y: 2, z: 128 } })];
      Object.assign(s.weapons[0], { rulerManning: true, crewWorkSpeed: 1 });
      s.weapons[0].aim = { az: 900, range: charge * 10 };
    },
  } });
  return { sim, api, weapon: api.state.weapons[0] };
}

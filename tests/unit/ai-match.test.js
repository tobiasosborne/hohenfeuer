// tests/unit/ai-match.test.js - owns Phase 1 acceptance 9: seeded headless AI match and final hash replay.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as C from '../../src/contracts.js';
import { TUNING as T } from '../../src/tuning.js';
import { createAiController } from '../../src/ai/controller.js';
import { createSlotTable } from '../../src/ai/slots.js';

const simModule = existsSync(new URL('../../src/sim/sim.js', import.meta.url)) ? await import('../../src/sim/sim.js') : null;
// TODO Phase 1 integration: remove this conditional once createSim is present in every lane checkout.
const options = typeof simModule?.createSim === 'function' ? {} : { skip: 'sim not ready' };

/** Isolated registered duel fixture: real cannon scatter/costs, mortal rulers, flat 192m map. */
function content() {
  C.resetRegistriesForTests();
  for (const [key, row] of Object.entries(T.blocks)) {
    const id = C.BLOCK[key.toUpperCase()], passable = [C.BLOCK.AIR, C.BLOCK.LADDER, C.BLOCK.DOOR].includes(id);
    C.registerBlock({ id, key, name: { de: key, en: key }, ...row, solid: !passable, walkOn: !passable,
      passable, projectileSolid: id !== C.BLOCK.AIR && id !== C.BLOCK.LADDER, climbable: id === C.BLOCK.LADDER,
      burnable: false, oriented: false, collider: id === C.BLOCK.AIR || id === C.BLOCK.LADDER ? C.COLLIDER.NONE : id === C.BLOCK.STAIRS ? C.COLLIDER.STAIRS : C.COLLIDER.CUBE, mapOnly: row.cost === null });
  }
  const row = T.weapons.cannon;
  C.registerWeapon({ id: 'cannon', name: { de: 'Kanone', en: 'Cannon' }, mount: C.MOUNT.WALL,
    footprint: [...T.weaponRules.wallFootprint], cost: row.cost, hp: row.hp, reloadS: row.reloadS, crewSlots: row.crewSlots,
    fireCost: row.fireCost, ammoLoads: 1, traj: C.TRAJ.STRAIGHT, elevDeg: [...T.aim.straightElevDeg], v0: row.v0, k: row.k,
    scatter: { azDeg: row.sAzDeg, vFrac: row.sV }, shot: { count: row.count, intervalS: row.intervalS,
      spreadDeg: row.spreadDeg, radius: row.projRadius, direct: row.direct, splash: row.splash,
      splashRadius: row.splashRadius, ignite: row.ignite, pierce: row.pierce } });
  for (const [id, palaceX, gunX, facing] of [['west', 2, 6, C.FACING.E], ['east', 5, 1, C.FACING.W]]) {
    const layers = Array.from({ length: 3 }, (_, y) => Array.from({ length: 8 }, (_, z) => {
      const cells = Array(8).fill('.');
      if (z >= 3 && z <= 5) cells[palaceX] = 'P';
      if (y === 0 && z === 4) cells[gunX] = 'M';
      return cells.join('');
    }));
    C.registerCastle({ id, size: [8, 4, 8], legend: { P: 'palace', M: 'mount' }, layers,
      weapons: [{ id: 'cannon', at: [gunX, 2, 4], facing }], mountSpots: [[gunX, 2, 4, facing]],
      shelters: [], workSpots: [], exit: [0, 1, 6], rulerSpawn: [0, 1, 6], throne: [0, 1, 6], population: T.npc.population });
  }
  C.registerBiome({ id: 'forest', terrainPalette: {}, props: [] });
  const map = { id: 'ai-duel', name: { de: 'Duell', en: 'Duel' }, biome: 'forest', size: [...T.world.duelMapM],
    slots: [{ origin: [32, 0, 64], facingDeg: 90, castle: 'west' },
      { origin: [32 + T.world.duelDistanceM, 0, 64], facingDeg: 270, castle: 'east' }],
    terrain: { amp: 0, octaves: T.world.terrainOctaves, ridge: null }, water: null,
    wind: { strength: 0, change: 0 }, startGold: T.economy.startGold, weaponCap: T.world.weaponCapDefault, suddenDeathS: null };
  C.registerMap(map); C.freezeRegistries();
  return { map: map.id, seed: 1, slots: createSlotTable(map, { aiLevel: 10, aiTactic: C.TACTIC.DAREDEVIL }) };
}

test('AI-vs-AI seed 1 finishes within 15 simulated minutes with one winner and identical hashes', options, t => {
  const opts = content();
  function run() {
    const controller = createAiController();
    // Local capability adapter: these contract commands are dispatched by Phase 1 sim.
    // Building commands remain covered by ai-build/controller; the Phase 1 dispatcher throws.
    const commandKinds = [C.CMD.AIM, C.CMD.FIRE, C.CMD.AUTO_FIRE, C.CMD.ORDER_CREW, C.CMD.SHELTER];
    const sim = simModule.createSim({ ...opts, hooks: {
      aiThink: (view, slot, rng) => controller.think({ ...view, commandKinds }, slot, rng),
    } });
    const maxTicks = 15 * 60 * T.sim.tickHz;
    for (let tick = 0; tick < maxTicks; tick++) {
      sim.tick([]);
      if (tick % T.sim.tickHz === 0 && sim.state.outcome) break;
    }
    const state = sim.state;
    assert.ok(state.outcome, 'headless match must end before the 15-minute limit');
    assert.equal(state.outcome.draw, false);
    assert.equal(state.outcome.winners.length, 1);
    return { hash: sim.hash(), tick: state.tick, winners: state.outcome.winners, shots: state.castles.map(c => c.stats.shots) };
  }
  const a = run(), b = run();
  assert.deepEqual(a, b);
  t.diagnostic(`seed 1 winner ${a.winners[0]}, ${a.tick} ticks (${a.tick / T.sim.tickHz}s), shots ${a.shots.join('/')}, hash ${a.hash}`);
});

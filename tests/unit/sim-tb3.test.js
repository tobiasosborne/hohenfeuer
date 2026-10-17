// tests/unit/sim-tb3.test.js - owns cannon designation dispatch and construction save/replay integration.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../src/contracts.js';
import { registerCoreSim } from '../../src/plugins/index.sim.js';
import { createSim, restoreSim } from '../../src/sim/sim.js';
import { npcTick } from '../../src/npc/index.js';
import { TUNING as T } from '../../src/tuning.js';

test('TB3: paid cannon builds through the real sim factory, emits placement, and survives save/restore', () => {
  C.resetRegistriesForTests(); registerCoreSim(); C.freezeRegistries();
  let initialized = false;
  const hooks = { npcTick(api, castle) {
    if (!initialized && castle.slot === 0) {
      initialized = true;
      api.state.weapons.find(w => w.slot === 0).hp = 0;
      // Put one real mason on the adjacent walkway; no direct construction mutation.
      const mason = api.state.npcs.find(n => n.slot === 0 && n.role === C.ROLE.MASON);
      mason.pos = { x: castle.plot.origin.x + 8.5, y: 7, z: castle.plot.origin.z + 23.5 };
    }
    npcTick(api, castle);
  } };
  const sim = createSim({ map: 'forest-duel', seed: 1, hooks }); sim.tick(); sim.drainEvents();
  sim.tick([{ type: C.CMD.DESIGNATE_WEAPON, slot: 0, tick: 1, seq: 0, cell: [7,7,23], weapon: 'cannon', facing: 3 }]);
  assert.ok(sim.state.castles[0].npcDesignations[0].weapon);
  const restored = restoreSim(sim.serialize(), { hooks });
  assert.equal(sim.hash(), restored.hash(), "pending weapon reservation round-trips exactly");
  const events = [];
  for (let tick = 0; tick < T.weaponRules.buildWallS * C.K.TICK_HZ; tick++) {
    sim.tick(); restored.tick(); events.push(...sim.drainEvents()); restored.drainEvents();
  }
  assert.equal(sim.hash(), restored.hash());
  const placed = events.find(e => e.type === C.EV.WEAPON_PLACED);
  assert.ok(placed);
  const w = sim.state.weapons.find(w => w.id === placed.payload.weaponId);
  assert.equal(w.defId, 'cannon'); assert.equal(w.slot, 0); assert.equal(w.facing, 3);
  assert.equal(sim.state.castles[0].npcDesignations.length, 0);
  assert.ok(sim.state.commandKinds.includes(C.CMD.DESIGNATE_WEAPON));
});

test('TB3: debug-directed enemy projectile damages a built block and masons repair it through an R order', () => {
  C.resetRegistriesForTests(); registerCoreSim(); C.freezeRegistries();
  let api;
  const sim = createSim({ map: 'forest-duel', seed: 1, hooks: { onReady(a) { api = a; } } });
  assert.ok(api);
  const cell = [41,7,29], p = sim.state.castles[0].plot, o = p.origin;
  api.setBlock({ x: o.x + cell[0] + 0.5, y: o.y + cell[1], z: o.z + cell[2] + 0.5 }, C.BLOCK.STONE);
  const def = C.getWeapon('cannon');
  api.spawnProjectile({ pos: { x: o.x + cell[0] + 6, y: o.y + cell[1] + 0.75, z: o.z + cell[2] + 0.5 },
    vel: { x: -30, y: 0, z: 0 }, radius: def.shot.radius, k: def.k,
    payload: { ...def.shot, splash: 0, splashRadius: 0 }, sourceSlot: 1, weaponId: 2 });
  const i = cell[0] + 48 * cell[2] + 2304 * cell[1];
  let impact = false;
  for (let tick = 0; tick < 30 && !impact; tick++) {
    sim.tick(); impact = sim.drainEvents().some(e => e.type === C.EV.IMPACT && e.payload.slot === 1);
  }
  assert.ok(impact); assert.ok(sim.state.castles[0].plot.hp[i] < T.blocks.stone.hp);
  sim.tick([{ type: C.CMD.REPAIR_PRIORITY, slot: 0, tick: sim.state.tick, seq: 0, cell }]);
  for (let tick = 0; tick < 35 * C.K.TICK_HZ && sim.state.castles[0].plot.hp[i] < T.blocks.stone.hp; tick++) sim.tick();
  assert.equal(sim.state.castles[0].plot.hp[i], T.blocks.stone.hp);
});

// tests/unit/npc-brain.test.js - owns population, state, crew and logistics integration acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { BLOCK, ROLE, JOB, NPC_STATE, CMD, EV, K } from '../../src/contracts.js';
import { TUNING as T } from '../../src/tuning.js';
import { npcTick, moraleTick, npcKinematics, crewPresent, reloadMultiplier, canFire,
  npcCommand, beginNpcImpact, endNpcImpact } from '../../src/npc/index.js';
import { fixture, person } from './npc-fixture.test.js';

function step(f, n = 1) { for (let i = 0; i < n; i++) { npcKinematics(f.api); npcTick(f.api, f.castle); moraleTick(f.api, f.castle); f.state.tick++; } }
const weapon = (overrides = {}) => ({ id: 0, slot: 0, defId: 'cannon', hp: T.weapons.cannon.hp,
  pos: { x: 8.5, y: 1, z: 3.5 }, crewOrdered: true, ammo: T.weaponRules.bufferLoads, facing: 0, ...overrides });

test('tick zero creates P NPCs with seeded thresholds and research role shares at usable spots', () => {
  const f = fixture({ population: 40 }); npcKinematics(f.api);
  assert.equal(f.state.npcs.length, 40); assert.equal(f.castle.population, 40);
  for (const [role, count] of [[ROLE.CREW, 16], [ROLE.RUNNER, 6], [ROLE.MASON, 6], [ROLE.CIVILIAN, 12]]) assert.equal(f.state.npcs.filter(n => n.role === role).length, count);
  assert.equal(new Set(f.state.npcs.map(n => n.id)).size, 40);
  assert.equal(f.draws(), 40); npcTick(f.api, f.castle); assert.equal(f.state.npcs.length, 40);
  for (const n of f.state.npcs) for (const key of ['id', 'castle', 'role', 'state', 'pos', 'hp', 'carrying', 'target', 'path']) assert.ok(key in n);
});

test('ORDER_CREW claims crew, counts only arrived living workers, release drops assignments', () => {
  const f = fixture({ population: 40 }); const w = weapon({ crewOrdered: false }); f.state.weapons.push(w);
  npcCommand(f.api, { type: CMD.ORDER_CREW, slot: 0, weaponId: 0, on: 1 }); step(f, 150);
  assert.equal(crewPresent(w, f.castle), T.weapons.cannon.crewSlots);
  assert.equal(w.crewPresent, T.weapons.cannon.crewSlots);
  npcCommand(f.api, { type: CMD.ORDER_CREW, slot: 0, weaponId: 0, on: 0 }); step(f);
  assert.equal(crewPresent(w, f.castle), 0);
  assert.equal(f.castle.jobs.some(j => j.kind === JOB.CREW), false);
});

test('N=3 reload table for 0..3 crew, ruler counts, and minimum crew fire gate', () => {
  const f = fixture(); f.castle.morale = 50; const w = weapon();
  for (let crew = 0; crew <= 3; crew++) {
    w.crewPresent = crew; w.rulerManning = false; w.crewWorkSpeed = 1;
    assert.equal(crewPresent(w, f.castle), crew);
    assert.equal(T.weapons.cannon.reloadS * reloadMultiplier(w, f.castle), T.weapons.cannon.reloadS * 3 / Math.max(1, crew));
    assert.equal(canFire(w, f.castle), crew >= Math.ceil(T.weaponRules.minCrewFrac * 3));
    w.rulerManning = true;
    assert.equal(crewPresent(w, f.castle), Math.min(3, crew + 1));
    assert.ok(canFire(w, f.castle));
    assert.equal(reloadMultiplier(w, f.castle), 3 / Math.max(1, Math.min(3, crew + 1)));
  }
  w.ammo = 0; assert.equal(canFire(w, f.castle), false);
});

test('runner takes two loads and deposits at operator cell; destroyed magazine starves buffer', () => {
  const f = fixture(); f.castle.npcSpawned = true; f.castle.workSpots = [];
  f.state.npcs.push(person(4, ROLE.RUNNER, [2, 1, 3]));
  const w = weapon({ ammo: 0, crewOrdered: false }); f.state.weapons.push(w); f.put(2, 1, 2, BLOCK.MAGAZINE);
  step(f, 150); assert.equal(w.ammo, T.weaponRules.bufferLoads);
  assert.equal(f.castle.magazines[0].stock, T.magazine.capacityLoads - T.npc.carryLoads);
  f.put(2, 1, 2, BLOCK.AIR); w.rulerManning = true;
  for (let i = 0; i < T.weaponRules.bufferLoads; i++) { assert.ok(canFire(w, f.castle)); w.ammo--; }
  step(f, 180); w.rulerManning = true; assert.equal(w.ammo, 0); assert.equal(canFire(w, f.castle), false);
  assert.equal(f.castle.magazines.length, 0);
});

test('shelter preempts civilians and empty runners, reserves one cell each, carrying runners continue', () => {
  const f = fixture(); f.castle.npcSpawned = true;
  f.state.npcs = [person(4, ROLE.CIVILIAN), person(5, ROLE.RUNNER, [2, 1, 1]), { ...person(6, ROLE.RUNNER, [3, 1, 1]), carrying: 2 }];
  npcCommand(f.api, { type: CMD.SHELTER, slot: 0, on: 1 }); step(f, 100);
  assert.equal(f.state.npcs[0].state, NPC_STATE.SHELTER); assert.equal(f.state.npcs[1].state, NPC_STATE.SHELTER);
  assert.notDeepEqual(f.state.npcs[0].shelterCell, f.state.npcs[1].shelterCell);
  assert.notEqual(f.state.npcs[2].state, NPC_STATE.SHELTER);
  npcCommand(f.api, { type: CMD.SHELTER, slot: 0, on: 0 }); step(f); assert.notEqual(f.state.npcs[0].state, NPC_STATE.SHELTER);
});

test('flee/return hysteresis holds at thresholds and drops claims', () => {
  const f = fixture(); f.castle.npcSpawned = true; const n = person(4, ROLE.CIVILIAN, [0, 1, 0]); n.fleeThreshold = 25; f.state.npcs.push(n);
  f.castle.morale = 24; npcTick(f.api, f.castle); assert.equal(n.state, NPC_STATE.FLEE);
  f.state.tick++; f.castle.morale = 40; npcTick(f.api, f.castle); assert.ok(n.state === NPC_STATE.FLEE || n.state === NPC_STATE.SHELTER);
  f.state.tick++; f.castle.morale = 41; npcTick(f.api, f.castle); assert.equal(n.fleeing, false);
  assert.equal(f.events.filter(e => e.type === EV.NPC_FLED).length, 1);
  assert.equal(f.events.filter(e => e.type === EV.NPC_RETURNED).length, 1);
});

test('low morale deserts highest-id civilian after 20s, then one each 10s, without death penalties', () => {
  const f = fixture(); f.castle.npcSpawned = true; f.castle.morale = T.morale.floor;
  f.state.npcs = [person(4, ROLE.CIVILIAN), person(5, ROLE.CIVILIAN), person(6, ROLE.CREW)];
  step(f, T.npc.desertAfterS * K.TICK_HZ + 2);
  assert.equal(f.events.filter(e => e.type === EV.NPC_DESERTED)[0].payload.entityId, 5);
  step(f, T.npc.desertEveryS * K.TICK_HZ);
  assert.equal(f.events.filter(e => e.type === EV.NPC_DESERTED)[1].payload.entityId, 4);
  assert.equal(f.events.some(e => e.type === EV.NPC_DIED), false);
  assert.equal(f.castle.moraleState.deaths.length, 0);
});

test('draft retags one civilian every 10s for minimum runners, then masons, then needed crew', () => {
  const f = fixture(); f.castle.npcSpawned = true; f.state.npcs = Array.from({ length: 10 }, (_, i) => person(i + 4, ROLE.CIVILIAN));
  npcTick(f.api, f.castle); assert.equal(f.state.npcs.filter(n => n.role === ROLE.RUNNER).length, 0);
  f.state.tick = T.npc.draftEveryS * K.TICK_HZ; npcTick(f.api, f.castle);
  assert.equal(f.state.npcs.filter(n => n.role === ROLE.RUNNER).length, 1);
});

test('path following uses carry, stair and ladder speeds and stops exactly at arrival', () => {
  const f = fixture(); f.castle.npcSpawned = true;
  const n = person(4, ROLE.RUNNER); n.state = NPC_STATE.WALK; n.carrying = 2; n.path = [[1, 1, 1], [2, 1, 1]]; n.pathIndex = 1; n.pathNavVersion = f.plot.navVersion;
  f.state.npcs.push(n); npcKinematics(f.api);
  assert.ok(Math.abs(n.pos.x - (1.5 + T.npc.carrySpeed * K.DT)) < 1e-9);
  f.put(2, 1, 1, BLOCK.LADDER); f.put(2, 2, 1, BLOCK.LADDER);
  n.pos = { x: 2.5, y: 1, z: 1.5 }; n.path = [[2, 1, 1], [2, 2, 1]]; n.pathIndex = 1; n.pathNavVersion = f.plot.navVersion;
  npcKinematics(f.api); assert.equal(n.pos.y, 1 + T.npc.ladderSpeed * K.DT);
  for (let i = 0; i < K.TICK_HZ; i++) { f.state.tick++; npcKinematics(f.api); }
  assert.deepEqual(n.pos, { x: 2.5, y: 2, z: 1.5 }); assert.equal(n.state, NPC_STATE.WORK);
});

test('impact adapter credits a multi-cell projectile once and persists through plain snapshots', () => {
  const f = fixture(); const g = fixture({ id: 1 }); f.state.castles.push(g.castle);
  f.castle.morale = g.castle.morale = 50; g.put(3, 1, 3, BLOCK.PALACE); g.put(4, 1, 3, BLOCK.STONE);
  const before = beginNpcImpact(f.api, { projectile: { id: 99 }, sourceSlot: 0 });
  g.put(3, 1, 3, BLOCK.AIR); g.put(4, 1, 3, BLOCK.AIR);
  endNpcImpact(f.api, before); endNpcImpact(f.api, before);
  moraleTick(f.api, f.castle); moraleTick(f.api, g.castle);
  assert.ok(f.castle.morale > 50); assert.ok(g.castle.morale < 50);
  assert.deepEqual(JSON.parse(JSON.stringify(f.castle.moraleState)), f.castle.moraleState);
});

test('160 NPC steady-state average tick advisory (4 ms target, no failure under load)', () => {
  const fixtures = Array.from({ length: 4 }, (_, id) => fixture({ id, width: 48, depth: 48, height: 24, population: 40 }));
  for (const f of fixtures) { f.castle.workSpots = []; step(f, 10); }
  const count = 180, start = performance.now();
  for (let i = 0; i < count; i++) for (const f of fixtures) step(f);
  const ms = (performance.now() - start) / count;
  console.log(`NPC advisory: 160 NPCs average ${ms.toFixed(3)} ms/tick; target <= ${T.sim.tickBudgetMs} ms`);
  assert.equal(fixtures.reduce((sum, f) => sum + f.state.npcs.length, 0), 160);
});

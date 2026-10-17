// tests/unit/sim-engine.test.js - owns deterministic cannon duel, tick order and save/replay acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSim, restoreSim } from '../../src/sim/sim.js';
import { createWeapon, fireWeapon, tickWeapons } from '../../src/sim/weapons.js';
import * as C from '../../src/contracts.js';
import { geometryAim } from '../../src/ai/aim.js';
import { TUNING as T } from '../../src/tuning.js';

function content({ close = false, noSplash = false } = {}) {
  C.resetRegistriesForTests();
  for (const [key, row] of Object.entries(T.blocks)) {
    const id = C.BLOCK[key.toUpperCase()], passable = [C.BLOCK.AIR, C.BLOCK.LADDER, C.BLOCK.DOOR].includes(id);
    C.registerBlock({ id, key, name: { de: key, en: key }, ...row, solid: !passable, walkOn: !passable, passable, projectileSolid: id !== C.BLOCK.AIR && id !== C.BLOCK.LADDER, climbable: id === C.BLOCK.LADDER, burnable: false, oriented: false, collider: id === C.BLOCK.AIR || id === C.BLOCK.LADDER ? C.COLLIDER.NONE : id === C.BLOCK.STAIRS ? C.COLLIDER.STAIRS : C.COLLIDER.CUBE, mapOnly: row.cost === null });
  }
  const row = T.weapons.cannon;
  C.registerWeapon({ id: 'cannon', name: { de: 'Kanone', en: 'Cannon' }, mount: C.MOUNT.WALL, footprint: [...T.weaponRules.wallFootprint], cost: row.cost, hp: row.hp, reloadS: row.reloadS, crewSlots: row.crewSlots, fireCost: row.fireCost, ammoLoads: 1, traj: C.TRAJ.STRAIGHT, elevDeg: [...T.aim.straightElevDeg], v0: row.v0, k: row.k, scatter: { azDeg: 0, vFrac: 0 }, shot: { count: 1, intervalS: 0, spreadDeg: 0, radius: row.projRadius, direct: row.direct, splash: noSplash ? 0 : row.splash, splashRadius: noSplash ? 0 : row.splashRadius, ignite: 0, pierce: 0 } });
  const castle = { id: 'fixture', size: [8, 4, 8], legend: { '#': 'stone', P: 'palace', M: 'mount' }, layers: [['########', '#P######', '########', '########', '####M###', '########', '########', '########']], weapons: [{ id: 'cannon', at: [4, 2, 4], facing: C.FACING.E }], mountSpots: [], shelters: [], workSpots: [], exit: [0, 2, 0], rulerSpawn: [2, 2, 4], throne: [2, 2, 4], population: T.npc.population };
  C.registerCastle(castle);
  C.registerCastle({ ...castle, id: 'target', weapons: [], rulerSpawn: [6, 2, 4], throne: [6, 2, 4] });
  C.registerBiome({ id: 'forest', terrainPalette: {}, props: [] });
  const map = { id: 'fixture-map', name: { de: 'Duel', en: 'Duel' }, biome: 'forest', size: [...T.world.duelMapM], slots: [{ origin: [0, 0, 0], facingDeg: 90, castle: 'fixture' }, { origin: [close ? 64 : T.world.duelDistanceM, 0, 0], facingDeg: 270, castle: 'target' }], terrain: { amp: 0, octaves: T.world.terrainOctaves, ridge: null }, water: null, wind: { strength: 0, change: 0 }, startGold: T.economy.startGold, weaponCap: T.world.weaponCapDefault, suddenDeathS: null };
  C.registerMap(map); C.freezeRegistries();
  const slots = map.slots.map((s, id) => ({ id, castleId: s.castle, team: id, color: 0, controller: C.CONTROLLER.LOCAL, aiLevel: 5, aiTactic: C.TACTIC.GENERAL }));
  return { map: map.id, seed: 1, slots };
}
const command = (type, tick, extra = {}, seq = 0) => ({ type, slot: 0, tick, seq, ...extra });

test('cannon reloads, fires atomically and pays exactly once per shot', () => {
  const opts = content(), def = C.getWeapon('cannon'), castle = { id: 0, slot: 0, gold: T.economy.startGold, stats: { shots: 0, ammoCosts: 0 }, eliminated: false };
  const weapon = createWeapon(def, { id: 2, slot: 0, pos: { x: 4, y: 2, z: 4 }, facing: 1 });
  let fired = 0;
  const context = { state: { castles: [castle], weapons: [weapon], rulers: [], wind: null }, emit() {}, rng: () => () => 0.5, spawnProjectile() { fired++; }, getWeapon: C.getWeapon, castleOf: () => castle };
  assert.equal(fireWeapon(context, weapon), true);
  assert.equal(castle.gold, T.economy.startGold - def.fireCost);
  assert.equal(fireWeapon(context, weapon), false);
  for (let i = 0; i < Math.ceil(def.reloadS / C.K.DT); i++) tickWeapons(context);
  assert.equal(fireWeapon(context, weapon), true);
  assert.equal(fired, 2);
  castle.gold = 0; weapon.reload = def.reloadS;
  assert.equal(fireWeapon(context, weapon), false);
  assert.equal(opts.seed, 1);
});

test('same command log and seed produces identical hashes; saves resume exactly', () => {
  const opts = content(), a = createSim(opts), b = createSim(opts);
  for (let tick = 0; tick < 120; tick++) {
    const commands = tick === 0 ? [command(C.CMD.FIRE, tick, { weaponId: 0 }, 1), command(C.CMD.AIM, tick, { weaponId: 0, az: 900, range: 384 }, 0)] : [];
    a.tick(commands); b.tick(commands);
    assert.equal(a.hash(), b.hash());
  }
  const restored = restoreSim(a.serialize());
  assert.equal(restored.hash(), a.hash());
  for (let i = 0; i < 100; i++) { a.tick([]); restored.tick([]); assert.equal(a.hash(), restored.hash()); }
  const snapshot = a.state;
  snapshot.rulers[0].hp = 0;
  snapshot.castles[0].plot.type.fill(0);
  assert.equal(a.hash(), restored.hash(), 'external state snapshots cannot change sim state');
});

test('fixed tick order applies AI only on schedule and defers its commands to next tick', () => {
  const opts = content(), order = [];
  opts.slots[0].controller = C.CONTROLLER.AI;
  const sim = createSim({ ...opts, hooks: { onStage: name => order.push(name), aiThink: (view, slot) => [command(C.CMD.AIM, view.tick + 1, { weaponId: 0, az: 800, range: 380 })] } });
  sim.tick([]);
  assert.deepEqual(order, ['commands', 'kinematics', 'ai', 'weapons', 'projectiles', 'blasts', 'jobs', 'economy', 'rules']);
  assert.equal(sim.state.weapons[0].aim.az, 900);
  sim.tick([]);
  assert.equal(sim.state.weapons[0].aim.az, 800);
  assert.throws(() => sim.tick([command(C.CMD.AIM, 0, { weaponId: 0, az: 800, range: 380 })]), /tick/);
});

test('a cannonball through the opposing ruler eliminates its castle', () => {
  const opts = content({ close: true, noSplash: true }), sim = createSim(opts);
  const w = sim.state.weapons[0], r = sim.state.rulers[1];
  const from = { x: w.pos.x + 0.5 + 2 * T.weapons.cannon.projRadius, y: w.pos.y + 0.5, z: w.pos.z };
  const target = { ...r.pos, y: r.pos.y + T.people.height / 2 };
  const solution = geometryAim(from, target, C.getWeapon('cannon'));
  sim.tick([command(C.CMD.AIM, 0, { weaponId: 0, az: 900, range: Math.round(solution.dial * T.aim.rangeUnitsPerDial) }), command(C.CMD.FIRE, 0, { weaponId: 0 }, 1)]);
  for (let i = 0; i < 80 && !sim.state.outcome; i++) sim.tick([]);
  assert.equal(sim.state.rulers[1].hp, 0);
  assert.equal(sim.state.castles[1].reason, C.ELIM.RULER);
  assert.ok(sim.drainEvents().some(event => event.type === C.EV.RULER_DIED));
});

test('firing publishes the calm prediction and restores the last fired aim', () => {
  const sim = createSim(content());
  sim.tick([command(C.CMD.FIRE, 0, { weaponId: 0 })]);
  const fired = sim.state.weapons[0];
  assert.ok(fired.predictedImpact && Number.isFinite(fired.predictedImpact.x));
  sim.tick([command(C.CMD.AIM, 1, { weaponId: 0, az: 300, range: 500 })]);
  sim.tick([command(C.CMD.RESTORE_AIM, 2, { weaponId: 0 })]);
  assert.deepEqual(sim.state.weapons[0].aim, fired.lastAim);
});

test('default AI entry point runs without hook wiring and its memory survives restore', () => {
  const opts = content();
  opts.slots[0].controller = C.CONTROLLER.AI;
  const a = createSim(opts), b = createSim(opts);
  a.tick([]); b.tick([]);
  assert.ok(a.state.pendingCommands.some(c => c.type === C.CMD.ORDER_CREW));
  const restored = restoreSim(a.serialize());
  for (let tick = 1; tick < 32; tick++) {
    a.tick([]); b.tick([]); restored.tick([]);
    assert.equal(a.hash(), b.hash());
    assert.equal(a.hash(), restored.hash());
  }
});

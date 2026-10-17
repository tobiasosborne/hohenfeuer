// tests/unit/sim-weapon-effects.test.js - owns atomic bursts, rocket staging, fire and piercing regressions.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../src/contracts.js';
import { TUNING as T } from '../../src/tuning.js';
import * as B from '../../src/sim/ballistics.js';
import * as D from '../../src/sim/damage.js';
import { createWeapon, fireWeapon, tickWeapons } from '../../src/sim/weapons.js';
import { content, fixture } from '../evidence/tb4-weapon-fixture.mjs';
import { createPlot, setCell, cellIndex } from '../../src/world/grid.js';
import { createStreams } from '../../src/core/rng.js';
import { restoreSim } from '../../src/sim/sim.js';

for (const id of ['double-cannon', 'hellfire']) test(`${id}: delayed rounds retain paid aim and survive restore; destruction cancels the burst`, () => {
  content(); const { sim, api, weapon } = fixture(id), def = C.getWeapon(id), events = [];
  sim.tick([{ type: C.CMD.FIRE, slot: 0, seq: 0, tick: 0, weaponId: 0 }]);
  assert.equal(api.state.projectiles.length, 1);
  const blob = sim.serialize(); const restored = restoreSim(blob, { hooks: { npcTick() {}, npcKinematics() {}, moraleTick() {} } });
  assert.equal(restored.hash(), sim.hash());
  for (let tick = 1; tick < 100; tick++) {
    const cmd = tick === 1 ? [{ type: C.CMD.AIM, slot: 0, seq: 1, tick, weaponId: 0, az: 2700, range: 2550 }] : [];
    sim.tick(cmd); restored.tick(cmd); events.push(...sim.drainEvents()); restored.drainEvents();
  }
  assert.equal(sim.hash(), restored.hash());
  const fired = events.filter(e => e.type === C.EV.SHOT_FIRED);
  assert.equal(fired.length, def.shot.count); assert.ok(fired.every(e => e.payload.vel[0] > 0));
  assert.equal(api.state.castles[0].stats.ammoCosts, def.fireCost); assert.equal(weapon.ammo, 1);
  const cancelled = fixture(id); cancelled.sim.tick([{ type: C.CMD.FIRE, slot: 0, seq: 0, tick: 0, weaponId: 0 }]);
  cancelled.weapon.hp = 0; cancelled.sim.drainEvents();
  for (let tick = 0; tick < 100; tick++) cancelled.sim.tick();
  assert.equal(cancelled.sim.drainEvents().filter(e => e.type === C.EV.SHOT_FIRED).length, 0);
});

test('rocket uses fixed native speed 1000, charge burn ticks, thrust 45 and the 24/28 payload', () => {
  content(); const def = C.getWeapon('rocket');
  for (const charge of [1, 64, 127, 255]) assert.equal(B.launchSpeed(def, charge), 1000 * T.sim.nativePositionM / T.sim.nativeTickS);
  const p = B.createFlightProjectile(def, { charge: 10, elevation: B.fixedElevation(def), pos: { x: 0, y: 100, z: 0 }, payload: def.shot });
  assert.equal(p.propulsion.burnS, 10 * T.sim.nativeTickS);
  assert.equal(p.propulsion.thrust, 45 * T.sim.nativePositionM / T.sim.nativeTickS ** 2);
  assert.equal(p.propulsion.mass, 55 + 2 * 10);
  assert.deepEqual([p.payload.direct, p.payload.splash, p.payload.splashRadius], [1, 1, 0]);
  const ballistic = { pos: { ...p.pos }, vel: { ...p.vel }, k: p.k };
  B.integrateProjectile(p); B.integrateProjectile(ballistic);
  assert.ok(p.vel.y > ballistic.vel.y);
  for (let i = 1; i < 80; i++) B.integrateProjectile(p);
  assert.equal(p.propulsion.stage, 'payload'); assert.equal(p.propulsion.mass, 55);
  assert.equal(p.k, 53 / (60 * T.sim.nativeDragDivisor * T.sim.nativePositionM));
  assert.deepEqual([p.payload.direct, p.payload.splash, p.payload.splashRadius], [24, 28, 1152 * T.sim.splashNativePositionM]);
});

function fireContext(seed = 4) {
  const plot = createPlot({ width: 8, depth: 8, height: 4 });
  const streams = createStreams(seed), state = { tick: 0, castles: [{ id: 0, slot: 0, plot }], weapons: [], rulers: [], npcs: [] };
  return { state, getBlock: C.getBlock, rng: name => streams.get(name), emit() {} };
}
test('fire ignites only burnable cells, burns 2 dp/s for 10s and spreads on the independent seeded stream', () => {
  content();
  function run(seed) {
    const ctx = fireContext(seed), plot = ctx.state.castles[0].plot;
    for (const [x, id] of [[2,C.BLOCK.FLOOR], [3,C.BLOCK.WOOD], [4,C.BLOCK.STONE]]) setCell(plot, x, 1, 3, id, 100);
    D.applyBlast(ctx, { pos: { x: 2.5, y: 1.5, z: 3.5 }, radius: 0, direct: 0, splash: 0, ignite: 0.6, sourceSlot: 1 });
    assert.ok(plot.meta[cellIndex(plot,2,1,3)] & C.META.BURNING_BIT);
    assert.equal(plot.meta[cellIndex(plot,3,1,3)] & C.META.BURNING_BIT, 0);
    for (let i = 0; i < 300; i++) { D.tickFire(ctx, C.K.DT); ctx.state.tick++; }
    assert.equal(plot.hp[cellIndex(plot,2,1,3)], 80);
    assert.equal(plot.meta[cellIndex(plot,2,1,3)] & C.META.BURNING_BIT, 0);
    assert.equal(plot.hp[cellIndex(plot,4,1,3)], 100, 'stone never burns');
    return [...plot.hp];
  }
  assert.deepEqual(run(4), run(4));
  const spread = fireContext(), p = spread.state.castles[0].plot;
  setCell(p,2,1,3,C.BLOCK.WOOD,100); setCell(p,3,1,3,C.BLOCK.WOOD,100);
  D.applyBlast(spread,{pos:{x:2.5,y:1.5,z:3.5},ignite:0.6});
  const draws = []; spread.rng = stream => () => { draws.push(stream); return 0; };
  D.tickFire(spread,1);
  assert.ok(p.meta[cellIndex(p,3,1,3)] & C.META.BURNING_BIT); assert.deepEqual(draws,[C.RNG_STREAM.FIRE]);
});

test('ballista kills at most three people along its actual collision line and stops at a wall', () => {
  content();
  for (const wall of [false, true]) {
    const { sim, api } = fixture('ballista');
    api.state.weapons[0].pos = { x: 79, y: 2, z: 128 };
    api.state.npcs = [0,1,2,3].map(n => ({ id: 100+n, slot: 1, castle: 1, hp: 100, pos: { x: 81+n*2, y: 1, z: 128 } }));
    if (wall) api.setBlock({ x: 82.5,y: 1.5,z: 128.5 },C.BLOCK.STONE);
    const def = C.getWeapon('ballista');
    api.spawnProjectile({ pos: { x: 80,y: 1.8,z: 128 }, vel: { x: 100,y: 0,z: 0 }, radius: def.shot.radius,k:0,payload:{...def.shot},sourceSlot:0,weaponId:0 });
    for(let t=0;t<10;t++) sim.tick();
    assert.equal(api.state.npcs.filter(n => n.hp<=0).length,wall?1:3);
    assert.equal(api.state.npcs.at(-1).hp,100,'the fourth person receives no zero-radius phantom splash');
  }
});

test('piercing resolves multiple capsules in the same swept tick without restarting the flight lifetime', () => {
  content(); const {sim,api}=fixture('ballista'),def=C.getWeapon('ballista');
  api.state.weapons[0].pos={x:79,y:2,z:128};
  api.state.npcs=[0,1,2,3].map(n=>({id:100+n,slot:1,castle:1,hp:100,pos:{x:81+n*2,y:1,z:128}}));
  api.spawnProjectile({pos:{x:80,y:1.8,z:128},vel:{x:1000,y:0,z:0},radius:def.shot.radius,k:0,payload:{...def.shot},sourceSlot:0,weaponId:0});
  sim.tick();
  assert.equal(api.state.npcs.filter(n=>n.hp<=0).length,3);
  assert.equal(api.state.npcs[3].hp,100);assert.equal(api.state.projectiles.length,0);
});

for(const [id,due] of [['double-cannon',[0,9]],['hellfire',[0,17,34,51,67]]]) test(`${id}: burst due ticks use cumulative interval and one reload/payment`,()=>{
  content();const def=C.getWeapon(id),castle={slot:0,gold:1500,eliminated:false},weapon=createWeapon(def,{id:0,slot:0,pos:{x:0,y:1,z:0}}),fired=[];
  Object.assign(weapon,{crewPresent:def.crewSlots,crewWorkSpeed:1});
  const ctx={state:{tick:0,castles:[castle],weapons:[weapon]},getWeapon:C.getWeapon,castleOf:()=>castle,rng:()=>()=>0.5,spawnProjectile(){},emit(type){if(type===C.EV.SHOT_FIRED)fired.push(ctx.state.tick);}};
  assert.ok(fireWeapon(ctx,weapon));
  for(let tick=1;tick<=80;tick++){ctx.state.tick=tick;tickWeapons(ctx);}
  assert.deepEqual(fired,due);assert.equal(castle.gold,1500-def.fireCost);assert.equal(weapon.ammo,1);
  assert.ok(Math.abs(weapon.reload-80/30)<1e-9);
});

test('custom onFire can handle spawning and onTick runs once per live weapon tick',()=>{
  content(); const base=C.getWeapon('cannon'),calls=[],spawned=[];
  C.resetRegistriesForTests();
  const def={...base,id:'hook-fixture',onFire(api,weapon){calls.push('fire');api.spawnProjectile({pos:weapon.pos,vel:{x:1,y:2,z:0}});return true;},onTick(){calls.push('tick');}};
  C.registerWeapon(def);C.freezeRegistries();
  const castle={slot:0,gold:1500,eliminated:false},weapon=createWeapon(C.getWeapon(def.id),{id:0,slot:0,pos:{x:0,y:1,z:0}});
  Object.assign(weapon,{crewPresent:def.crewSlots,crewWorkSpeed:1});
  const ctx={state:{tick:0,castles:[castle],weapons:[weapon]},getWeapon:C.getWeapon,castleOf:()=>castle,rng:()=>()=>0.5,spawnProjectile:p=>spawned.push(p),emit(){}};
  assert.ok(fireWeapon(ctx,weapon));tickWeapons(ctx);
  assert.deepEqual(calls,['fire','tick']);assert.equal(spawned.length,1);
  assert.equal(castle.gold,1500-def.fireCost);
});

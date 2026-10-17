// Owns repair-wave-two stall diagnosis and launch/death attribution regressions.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../src/contracts.js';
import { registerCoreSim } from '../../src/plugins/index.sim.js';
import { createWeapon, tickWeapons } from '../../src/sim/weapons.js';
import { damagePerson } from '../../src/sim/damage.js';
import { createSim } from '../../src/sim/sim.js';
import { fixture } from './npc-fixture.test.js';
import { TUNING as T } from '../../src/tuning.js';

test('every idle reason is causal, updated each tick, and emitted only on change', () => {
  C.resetRegistriesForTests(); registerCoreSim();
  const f = fixture(), def = C.getWeapon('cannon');
  const w = createWeapon(def, { id: 0, slot: 0, pos: { x: 5.5, y: 1, z: 4.5 }, facing: 1 });
  f.state.weapons.push(w); w.crewPresent = def.crewSlots;
  const ctx = { ...f.api, castleOf: () => f.castle, getWeapon: C.getWeapon, getBlock: C.getBlock };
  const check = (reason, detail) => {
    tickWeapons(ctx); assert.equal(w.idleReason, reason);
    const e = f.events.filter(e => e.type === C.EV.WEAPON_IDLE).at(-1);
    assert.equal(e.payload.reason, reason); detail?.(e.payload.detail);
    const count = f.events.length; tickWeapons(ctx); assert.equal(f.events.length, count);
  };
  check(C.IDLE_REASON.READY);
  w.crewPresent = 0;
  check(C.IDLE_REASON.NO_CREW, d => { assert.equal(d.present, 0); assert.equal(d.required, 2); });
  w.crewPresent = 3; w.ammo = 0;
  f.castle.jobs = [{ kind: C.JOB.HAUL_AMMO, target: { weaponId: 0 }, claimedBy: [12] }];
  check(C.IDLE_REASON.NO_AMMO, d => assert.equal(d.haulerEnRoute, true));
  w.ammo = 2; f.castle.gold = 0; check(C.IDLE_REASON.NO_GOLD);
  f.castle.gold = 1500; w.reload = 0; check(C.IDLE_REASON.RELOADING);
  w.reload = def.reloadS; f.put(6, 1, 4, C.BLOCK.STONE);
  check(C.IDLE_REASON.OBSTRUCTED, d => assert.deepEqual(d.cell, [6, 1, 4]));
  w.hp = 0; check(C.IDLE_REASON.DAMAGED);
  C.resetRegistriesForTests();
});

test('ruler death carries the actual projectile and weapon, including splash', () => {
  const f = fixture(), ruler = { id: 0, slot: 0, isRuler: true, hp: 100 };
  damagePerson({ ...f.api, damageSource: { fromWeapon: 7, projectileId: 81 } }, ruler, 100, 1, 'blast');
  assert.deepEqual(f.events.find(e => e.type === C.EV.RULER_DIED).payload,
    { slot: 0, cause: 'blast', fromCastle: 1, fromWeapon: 7, projectileId: 81 });
  assert.ok(T.rules.surrenderMorale >= 18 && T.rules.surrenderMorale <= 22);
});

test('deterministic launch prediction warns before impact and preserves killing-shot attribution', () => {
  C.resetRegistriesForTests();registerCoreSim();C.freezeRegistries();
  let api;const sim=createSim({map:'forest-duel',hooks:{onReady(a){api=a;}}});
  const r=api.state.rulers[1],p=api.state.castles[1].plot;
  r.pos={x:p.origin.x+3,y:1,z:p.origin.z+3};
  const projectileId=api.spawnProjectile({pos:{x:r.pos.x+10,y:1.9,z:r.pos.z},vel:{x:-30,y:0,z:0},k:0,
    payload:{direct:16,splash:20,splashRadius:4.7},sourceSlot:0,weaponId:1,radius:.1});
  const threat=sim.drainEvents().find(e=>e.type===C.EV.RULER_THREAT);
  assert.ok(threat);assert.equal(threat.payload.projectileId,projectileId);
  assert.equal(threat.payload.fromWeapon,1);assert.equal(threat.payload.castle,1);
  assert.ok(threat.payload.etaTicks>0);assert.equal(r.hp,100);
  let death;
  for(let i=0;i<30&&!death;i++){sim.tick();death=sim.drainEvents().find(e=>e.type===C.EV.RULER_DIED);}
  assert.equal(death?.payload.projectileId,projectileId);
  assert.equal(death.payload.fromCastle,0);assert.equal(death.payload.fromWeapon,1);
  C.resetRegistriesForTests();
});

test('a shell-induced roof collapse keeps the shell attribution', () => {
  C.resetRegistriesForTests();registerCoreSim();C.freezeRegistries();let api;
  const sim=createSim({map:'forest-duel',hooks:{onReady(a){api=a;}}}),c=api.state.castles[0],o=c.plot.origin,r=api.state.rulers[0];
  r.pos={x:o.x+3.5,y:1,z:o.z+3.5};r.hp=40;r.lastDamageTick=0;
  for(let y=1;y<=3;y++)api.setBlock({x:o.x+4.5,y,z:o.z+3.5},C.BLOCK.STONE);
  api.setBlock({x:o.x+3.5,y:3,z:o.z+3.5},C.BLOCK.STONE);
  const projectileId=api.spawnProjectile({pos:{x:o.x+4.5,y:1.8,z:o.z+10},vel:{x:0,y:0,z:-30},k:0,
    payload:{direct:100,splash:0,splashRadius:0},sourceSlot:1,weaponId:2,radius:.1});
  let death;for(let t=0;t<60&&!death;t++){sim.tick();death=sim.drainEvents().find(e=>e.type===C.EV.RULER_DIED);}
  assert.deepEqual(death?.payload,{slot:0,cause:'collapse',fromCastle:1,fromWeapon:2,projectileId});
  C.resetRegistriesForTests();
});

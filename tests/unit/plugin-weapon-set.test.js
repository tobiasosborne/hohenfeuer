// tests/unit/plugin-weapon-set.test.js - owns full-set plugin data, fixture flight and view fallback conformance.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../src/contracts.js';
import { TUNING as T } from '../../src/tuning.js';
import { content, fixture, IDS } from '../evidence/tb4-weapon-fixture.mjs';
import { fireWeapon, weaponRangeTable } from '../../src/sim/weapons.js';
import { fixedElevation, traceFlight } from '../../src/sim/ballistics.js';

for (const id of IDS) test(`${id}: validates, fires its whole salvo once, lands, damages and replays identically`, () => {
  content(); const def = C.getWeapon(id), row = T.weapons[id];
  assert.ok(def, `${id} registered`); assert.equal(C.validateWeaponPlugin(def), true);
  for (const key of ['cost', 'fireCost', 'hp', 'reloadS', 'crewSlots', 'v0', 'k', 'mount', 'traj']) assert.equal(def[key], row[key], key);
  assert.equal(fixedElevation(def), row.elevationDeg);
  const max = weaponRangeTable(def).at(-1);
  const full = traceFlight({ ...def, charge: max.charge, elevation: fixedElevation(def) });
  assert.equal(full.landed, true); assert.ok(full.range <= row.maxRangeM, `${full.range} <= ${row.maxRangeM}`);
  function run() {
    const { sim, api, weapon } = fixture(id);
    // A high wooden curtain around the firing point guarantees a real DDA/block impact
    // for all pitches/spread, rather than directly calling applyBlast in conformance.
    const plot = api.state.castles[0].plot;
    for (let x = 9; x <= 23; x++) for (let z = 16; z <= 32; z++) for (let y = 1; y < 24; y++) {
      if (x !== 9 && x !== 23 && z !== 16 && z !== 32) continue;
      const i = x + 48 * z + 2304 * y; plot.type[i] = C.BLOCK.WOOD; plot.hp[i] = 12;
    }
    const events = [];
    sim.tick([{ type: C.CMD.FIRE, slot: 0, seq: 0, tick: 0, weaponId: 0 }]);
    assert.equal(weapon.ammo, T.weaponRules.bufferLoads - 1);
    assert.equal(api.state.castles[0].stats.shots, 1);
    assert.equal(api.state.castles[0].stats.ammoCosts, def.fireCost);
    assert.equal(fireWeapon(api, weapon), false, 'reload gates repeated firing');
    for (let i = 0; i < T.sim.tickHz * 12; i++) { sim.tick(); events.push(...sim.drainEvents()); }
    assert.equal(events.filter(e => e.type === C.EV.SHOT_FIRED).length, def.shot.count);
    assert.ok(events.some(e => [C.EV.BLOCK_DAMAGED, C.EV.BLOCK_DESTROYED].includes(e.type)), 'real impact applies damage');
    assert.equal(api.state.projectiles.length, 0);
    return { hash: sim.hash(), events };
  }
  assert.deepEqual(run(), run());
});

test('all twelve views use kit-v1 paths, canonical nodes and an absent-model fallback', () => {
  content();
  for (const id of [...IDS, 'zeppelin', 'bomb']) {
    const view = C.getView(C.PLUGIN_KIND.WEAPON, id);
    assert.ok(view, id); assert.equal(C.validateWeaponView(id, view), true);
    assert.equal(view.model, `assets/kit-v1/${id}.glb`);
    for (const key of ['yaw', 'pitch', 'muzzle', 'sight']) assert.equal(view.nodes[key], key[0].toUpperCase() + key.slice(1));
    const fallback = view.create(); fallback.setAim(90, 36.73828125);
    assert.ok(fallback.nodes.muzzle); fallback.dispose();
  }
});

test('zeppelin and bomb are registered map-only unavailable stubs with no firing bill', async () => {
  content();
  for (const id of ['zeppelin', 'bomb']) {
    const plugin = await import(`../../src/plugins/weapons/${id}/${id}.sim.js`);
    assert.deepEqual(plugin.AVAILABILITY, { mapOnly: true, available: false });
    assert.equal(C.validateWeaponPlugin(C.getWeapon(id)), true);
    const { api, weapon } = fixture(id); const before = JSON.stringify(api.state);
    assert.equal(fireWeapon(api, weapon), false); assert.equal(JSON.stringify(api.state), before);
  }
});

for(const id of IDS) test(`${id}: production terrain landing stays inside the declared range bound`,()=>{
  content();const {sim,api,weapon}=fixture(id,{charge:50}),def=C.getWeapon(id),events=[];
  sim.tick([{type:C.CMD.FIRE,slot:0,seq:0,tick:0,weaponId:0}]);
  for(let tick=1;tick<30*15;tick++){sim.tick();events.push(...sim.drainEvents());}
  const impacts=events.filter(e=>e.type===C.EV.IMPACT);
  assert.equal(impacts.length,def.shot.count,'every projectile lands inside the fixture map');
  for(const event of impacts){const [x,,z]=event.payload.pos;assert.ok(Math.hypot(x-weapon.pos.x,z-weapon.pos.z)<=T.weapons[id].maxRangeM);}
  assert.equal(api.state.projectiles.length,0);
});

test('available kit GLBs contain every named view part; absent assets retain the fallback contract',async()=>{
  content();const {existsSync,readFileSync}=await import('node:fs');
  for(const id of [...IDS,'zeppelin','bomb']){
    const view=C.getView(C.PLUGIN_KIND.WEAPON,id),path=new URL(`../../${view.model}`,import.meta.url);
    if(!existsSync(path)){const fallback=view.create();assert.ok(fallback.nodes.muzzle);fallback.dispose();continue;}
    const b=readFileSync(path),glb=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12))),names=new Set(glb.nodes.map(n=>n.name));
    for(const name of Object.values(view.nodes))assert.ok(names.has(name),`${id}: ${name}`);
  }
});

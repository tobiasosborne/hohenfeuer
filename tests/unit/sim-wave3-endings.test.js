// owns: honest terminal shot events without fabricated impacts or reference-state changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../src/contracts.js';
import {registerCoreSim} from '../../src/plugins/index.sim.js';
import {createSim} from '../../src/sim/sim.js';
import {TUNING as T} from '../../src/tuning.js';
import {integrateProjectile} from '../../src/sim/ballistics.js';
import {windVector} from '../../src/sim/wind.js';
function setup(){C.resetRegistriesForTests();registerCoreSim();C.freezeRegistries();let api;const sim=createSim({map:'forest-duel',hooks:{onReady(a){api=a;},npcTick(){},moraleTick(){},npcKinematics(){}}});return {sim,api};}
for(const reason of Object.values(C.LOST_REASON))test(`a removed ${reason} shot emits exactly one terminal loss at its last sim position`,()=>{
 const {sim,api}=setup(),map=C.getMap('forest-duel'),w=api.state.weapons[1];
 w.lastImpact={x:250,y:3,z:110};const previous={...w.lastImpact};
 const pos=reason===C.LOST_REASON.OUT_OF_MAP?{x:map.size[0]-.01,y:80,z:80}:reason===C.LOST_REASON.BELOW_GROUND?{x:190,y:T.sim.projectileMinY+.001,z:20}:{x:100,y:80,z:80};
 if(reason===C.LOST_REASON.BELOW_GROUND)for(const name of ['heights','baseHeights'])api.state.terrain[name]?.fill(T.sim.projectileMinY-100);
 const id=api.spawnProjectile({pos,vel:{x:reason===C.LOST_REASON.OUT_OF_MAP?30:0,y:reason===C.LOST_REASON.BELOW_GROUND?-30:0,z:0},k:0,payload:{},sourceSlot:0,weaponId:w.id,radius:.1});
 const p=api.state.projectiles.find(p=>p.id===id);if(reason===C.LOST_REASON.EXPIRED)p.age=T.sim.projectileMaxLifeS-C.K.SUBSTEP_DT/2;
 const expected=structuredClone(p);integrateProjectile(expected,windVector(api.state.wind));sim.drainEvents();sim.tick();
 assert.equal(api.state.projectiles.length,0);const events=sim.drainEvents();
 assert.equal(events.filter(e=>e.type===C.EV.IMPACT).length,0);
 assert.deepEqual(events.filter(e=>e.type===C.EV.PROJECTILE_LOST).map(e=>e.payload),[{slot:0,weaponId:w.id,projectileId:id,pos:[expected.pos.x,expected.pos.y,expected.pos.z],reason}]);
 assert.deepEqual(w.lastImpact,previous,'retain the last real impact for the UI reference mark');
 const stateHash=sim.hash(),saved=sim.serialize();
 api.emit(C.EV.PROJECTILE_LOST,{slot:0,weaponId:w.id,projectileId:id,pos:[expected.pos.x,expected.pos.y,expected.pos.z],reason});
 assert.equal(sim.hash(),stateHash,'the event itself changes no persisted state or RNG');
 assert.deepEqual(sim.serialize(),saved);sim.drainEvents();
 sim.tick();assert.ok(!sim.drainEvents().some(e=>e.type===C.EV.PROJECTILE_LOST));
});
for(const [label,slot,id]of [['own-obstruction',0,C.BLOCK.STONE],['enemy-wall',1,C.BLOCK.STONE],['palace',1,C.BLOCK.PALACE],['ground',null,null]])test(`real ${label} impacts retain their hit enum and report the interception kind`,()=>{
 const {sim,api}=setup();let pos;
 if(slot!==null){const o=api.state.castles[slot].plot.origin;pos={x:o.x+3.5,y:1.5,z:o.z+3.5};api.setBlock(pos,id);}
 else pos={x:160,y:0,z:30};
 const projectileId=api.spawnProjectile({pos:{...pos,y:pos.y+1.5},vel:{x:0,y:-30,z:0},k:0,payload:{direct:1,splash:0,splashRadius:0},sourceSlot:0,weaponId:1,radius:.1});sim.drainEvents();
 let impact;for(let t=0;t<30&&!impact;t++){sim.tick();impact=sim.drainEvents().find(e=>e.type===C.EV.IMPACT&&e.payload.projectileId===projectileId);}
 assert.ok(impact);assert.equal(impact.payload.hit,slot===null?'terrain':'block');assert.equal(impact.payload.hitKind,label);
});

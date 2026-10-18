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

test('a piercing hit precedes the same-tick terminal bounds event',()=>{
 const {sim,api}=setup(),r=api.state.rulers[1];
 r.pos={x:383.8,y:80,z:80};r.fallPeak=80;
 const projectileId=api.spawnProjectile({pos:{x:383.1,y:80.9,z:80},vel:{x:300,y:0,z:0},k:0,payload:{pierce:3,direct:0,splash:0,splashRadius:0},sourceSlot:0,weaponId:1,radius:.1});
 sim.drainEvents();sim.tick();const events=sim.drainEvents().filter(e=>e.payload.projectileId===projectileId&&[C.EV.IMPACT,C.EV.PROJECTILE_LOST].includes(e.type));
 assert.deepEqual(events.map(e=>e.type),[C.EV.IMPACT,C.EV.PROJECTILE_LOST]);
 assert.equal(events[0].payload.hit,'person');assert.equal(events[1].payload.reason,C.LOST_REASON.OUT_OF_MAP);
 assert.deepEqual(api.state.weapons[1].lastImpact,{x:events[0].payload.pos[0],y:events[0].payload.pos[1],z:events[0].payload.pos[2]});
});

test('same-tick hits keep the collision block kind after an earlier blast destroys it',()=>{
 const {sim,api}=setup(),o=api.state.castles[1].plot.origin,pos={x:o.x+3.5,y:1.5,z:o.z+3.5};
 api.setBlock(pos,C.BLOCK.PALACE);const ids=[];
 for(let n=0;n<2;n++)ids.push(api.spawnProjectile({pos:{...pos,y:3},vel:{x:0,y:-180,z:0},k:0,payload:{direct:200,splash:0,splashRadius:0},sourceSlot:0,weaponId:1,radius:.1}));
 sim.drainEvents();sim.tick();const hits=sim.drainEvents().filter(e=>e.type===C.EV.IMPACT&&ids.includes(e.payload.projectileId));
 assert.deepEqual(hits.map(e=>e.payload.hitKind),['palace','palace']);
 assert.ok(hits.every(e=>e.payload.hit==='block'));
 // Additional collision-category metadata does not alter the existing impact's state effects.
 const p={slot:0,weaponId:1,projectileId:999,pos:[pos.x,pos.y,pos.z],hit:'block'};
 api.emit(C.EV.IMPACT,p);const saved=sim.serialize(),hash=sim.hash();api.emit(C.EV.IMPACT,{...p,hitKind:'palace'});
 assert.equal(sim.hash(),hash);assert.deepEqual(sim.serialize(),saved);
});

for(const slot of [0,1])test(`the plot foundation in castle ${slot} is ground, retaining its real block collision`,()=>{
 const {sim,api}=setup(),o=api.state.castles[slot].plot.origin;
 const id=api.spawnProjectile({pos:{x:o.x+3.5,y:3,z:o.z+3.5},vel:{x:0,y:-60,z:0},k:0,payload:{direct:1,splash:0,splashRadius:0},sourceSlot:0,weaponId:1,radius:.1});sim.drainEvents();
 let hit;for(let t=0;t<30&&!hit;t++){sim.tick();hit=sim.drainEvents().find(e=>e.type===C.EV.IMPACT&&e.payload.projectileId===id);}
 assert.ok(hit);assert.equal(hit.payload.hit,'block');assert.equal(hit.payload.hitKind,'ground');assert.equal(hit.payload.pos[1],1);
});

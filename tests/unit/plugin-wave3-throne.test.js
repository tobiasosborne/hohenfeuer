// owns: the smallest east-throne correction, retaining all authored geometry and other anchors.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../src/contracts.js';
import {registerCoreSim} from '../../src/plugins/index.sim.js';
import {createSim} from '../../src/sim/sim.js';
import {createSlotTable} from '../../src/ai/slots.js';
import {selectTarget} from '../../src/ai/targets.js';
test('east throne alone reflects the west ruler and restores initial breach-target symmetry',()=>{
 C.resetRegistriesForTests();registerCoreSim();C.freezeRegistries();
 const map=C.getMap('forest-duel'),west=C.getCastle(map.slots[0].castle),east=C.getCastle(map.slots[1].castle);
 assert.equal(east.throne[0],47-west.throne[0]);
 for(const key of Object.keys(west).filter(k=>!['id','throne'].includes(k)))assert.deepEqual(east[key],west[key],key);
 let api;createSim({map,slots:createSlotTable(map,{aiLevel:5}),hooks:{onReady(a){api=a;a.state.wind.speed=0;}}});
 const s=api.state,guns=[s.weapons.find(w=>w.slot===0&&w.pos.x>100),s.weapons.find(w=>w.slot===1&&w.pos.x<280)];
 const t=guns.map((w,i)=>selectTarget(s,s.slots[i],w,{ballistic:true,breach:true,rulerSlots:[]}));
 assert.ok(t.every(Boolean));assert.equal(t[1].pos.x,map.size[0]-t[0].pos.x);assert.equal(t[1].pos.y,t[0].pos.y);assert.equal(t[1].pos.z,t[0].pos.z);
 C.resetRegistriesForTests();
});

// owns: isolated calm-air starting-target symmetry check for the one-cell ruler-throne offset.
import {writeFileSync} from 'node:fs';
import * as C from '../src/contracts.js';
import {registerCoreSim} from '../src/plugins/index.sim.js';
import {createSim} from '../src/sim/sim.js';
import {createSlotTable} from '../src/ai/slots.js';
import {selectTarget} from '../src/ai/targets.js';
registerCoreSim();C.freezeRegistries();const map=C.getMap('forest-duel'),rows=[];
for(const {reflected,avoid} of [{reflected:false,avoid:false},{reflected:false,avoid:true},{reflected:true,avoid:true}]){
 let api;const sim=createSim({map,seed:1,slots:createSlotTable(map,{aiLevel:5}),hooks:{onReady(a){api=a;a.state.wind.speed=0;if(reflected){a.state.rulers[1].pos.x+=1;a.state.castles[1].throne.x+=1;}}}}),s=api.state;
 const guns=[s.weapons.find(w=>w.slot===0&&w.pos.x>100),s.weapons.find(w=>w.slot===1&&w.pos.x<280)];
 const targets=guns.map((w,i)=>selectTarget(s,s.slots[i],w,{ballistic:true,breach:true,rulerSlots:avoid?[]:null}));
 rows.push({condition:!avoid?'baseline-without-ruler-avoidance':reflected?'east-throne-x-plus-1':'baseline',rulers:s.rulers.map(r=>r.pos),targets,reflectionDifference:targets[0]&&targets[1]?{x:targets[1].pos.x-(384-targets[0].pos.x),y:targets[1].pos.y-targets[0].pos.y,z:targets[1].pos.z-targets[0].pos.z}:null});
}
writeFileSync('tests/evidence/critique-v3/initial-target-symmetry.json',JSON.stringify({method:'One calm-air initial state, no random aim error; same voxels, guns and NPCs. Two diagnostic changes are separate: disable the ruler-avoidance test, or shift only east ruler/throne x by one metre.',rows},null,2));console.log(JSON.stringify(rows,null,2));

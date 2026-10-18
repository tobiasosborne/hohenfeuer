// owns: frozen headless terminal and pre-fatal-shot reference checkpoints for population warnings.
import {runMatch} from './critique-v3-hooks.mjs';
import {writeFileSync} from 'node:fs';
import {EV} from '../src/contracts.js';
const dir=process.env.WAVE3_OUT??'tests/evidence/repair-wave-3-ui',out=[];
for(const seed of [6,9]){
 const launches=new Map(),weaponLaunches=new Map(),states=new Map();let latestShot=null,impactShot=null,terminal=null;
 const result=runMatch({seed,map:'forest-duel',levels:[5,5],physicalLevels:[5,5],swap:false,compact:true,maxMinutes:20},()=>{},{tick(s,events,sim){
  states.set(s.tick,{tick:s.tick,castles:s.castles.map(c=>({population:c.population,surrender:c.surrender,palace:c.palaceIntegrity,reason:c.reason}))});if(states.size>180)states.delete(states.keys().next().value);
  for(const e of events){if(e.type===EV.SHOT_FIRED){latestShot=s.tick;weaponLaunches.set(e.payload.weaponId,s.tick);if(e.payload.projectileId!==undefined)launches.set(e.payload.projectileId,s.tick);}if(e.type===EV.IMPACT)impactShot=launches.get(e.payload.projectileId)??weaponLaunches.get(e.payload.weaponId)??latestShot;if(e.type===EV.CASTLE_ELIMINATED)terminal={...e.payload,tick:s.tick,lastShot:impactShot??latestShot,preShot:states.get((impactShot??latestShot)-1),last:states.get(s.tick-1)};}
 }});
 out.push({seed,hash:result.hash,tick:result.ticks,reason:result.eliminationReason,terminal});console.log(seed,result.ticks,result.eliminationReason,terminal?.lastShot);writeFileSync(`${dir}/ending-reference.json`,JSON.stringify(out,null,2));
}

// Owns a first-match walk/man/crew/fire command route on both physical sides of every duel.
import {writeFileSync} from 'node:fs';
import * as C from '../../../src/contracts.js';
import {registerCoreSim} from '../../../src/plugins/index.sim.js';
import {createSim} from '../../../src/sim/sim.js';
import {findPath} from '../../../src/npc/path.js';
import {TB1} from '../../../src/tb1-script.js';
import {operatorCell,localCell} from '../../../src/npc/model.js';
registerCoreSim();C.freezeRegistries();
const records=[];
for(const biome of ['forest','desert','ice','volcano'])for(const slot of [0,1]){
 let api;const sim=createSim({map:`${biome}-duel`,seed:1,hooks:{onReady(a){api=a;}}});
 const c=api.state.castles[slot],r=api.state.rulers[slot];
 const w=api.state.weapons.filter(w=>w.slot===slot).sort((a,b)=>slot?a.pos.x-b.pos.x:b.pos.x-a.pos.x)[0];
 const goal=operatorCell(w,c);let path=findPath(c.plot,localCell(c.plot,r.pos),goal,{clamber:false});
 if(biome==='forest')path=[localCell(c.plot,r.pos),...TB1.route.map(([x,z])=>[(slot?48-x:x)-.5,null,z-.5])];
 if(!path)throw Error(`${biome}/${slot}: no human route`);
 let step=1,shot=null;
 for(let tick=0;tick<90*30&&!shot;tick++){
  const cmds=[],emit=(type,p={})=>cmds.push({type,slot,tick:api.tick,seq:cmds.length,...p});
  if(step<path.length){const target=path[step],o=c.plot.origin,dx=o.x+target[0]+.5-r.pos.x,dz=o.z+target[2]+.5-r.pos.z,dy=target[1]===null?0:o.y+target[1]-r.pos.y;
   const d=Math.hypot(dx,dz),at=localCell(c.plot,r.pos),ladder=c.plot.type[at[0]+48*at[2]+2304*at[1]]===C.BLOCK.LADDER;
   if(d<.13&&Math.abs(dy)<.7){step++;}
   const yaw=d>.01?(Math.round(Math.atan2(dx,-dz)/(2*Math.PI)*65536)+65536)%65536:r.yaw;
   const fwd=d<.13&&dy>.1&&ladder?127:Math.min(127,Math.round(d/(4/30)*127));
   emit(C.CMD.MOVE,{fwd,strafe:0,yaw,pitch:0,jump:ladder&&d>=.13&&dy<.7?1:0,sprint:0});
  }else{
   emit(C.CMD.MOVE,{fwd:0,strafe:0,yaw:r.yaw,pitch:0,jump:0,sprint:0});
   if(r.manning!==w.id){emit(C.CMD.ORDER_CREW,{weaponId:w.id,on:1});emit(C.CMD.MAN_WEAPON,{weaponId:w.id});}
   else emit(C.CMD.FIRE,{weaponId:w.id});
  }
  sim.tick(cmds);for(const e of sim.drainEvents())if(e.type===C.EV.SHOT_FIRED&&e.payload.slot===slot)shot=api.tick/30;
 }
 records.push({biome,slot,gun:w.id,pathCells:path.length,stepsReached:step,firstShotS:shot,pos:r.pos,goal,paid:c.stats.ammoCosts});
 console.log(JSON.stringify(records.at(-1)));
}
writeFileSync(new URL('./playable.json',import.meta.url),JSON.stringify(records,null,2));
if(records.some(r=>r.firstShotS===null||r.firstShotS>90||r.paid<=0))process.exitCode=1;

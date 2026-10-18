// owns: controlled incoming-hit repair reachability and paid-material evidence for palace-bar captures.
import {writeFileSync} from 'node:fs';
import {registerCoreSim} from '../src/plugins/index.sim.js';
import {freezeRegistries,getWeapon,getBlock,CMD} from '../src/contracts.js';
import {TUNING as T} from '../src/tuning.js';
import {createSim} from '../src/sim/sim.js';
import {tb1Slots} from '../src/tb1-script.js';
import {palaceStatus} from '../src/ui/battle-feedback.js';
registerCoreSim();freezeRegistries();const results=[];
for(const y of [1,3]){let api;const sim=createSim({map:'forest-duel',seed:1,slots:tb1Slots(),hooks:{onReady(a){api=a}}}),def=getWeapon('cannon'),cell=[25,y,22];let damaged=[],shots=0;
 for(;shots<20&&!damaged.length;shots++){const o=api.state.castles[0].plot.origin;api.spawnProjectile({pos:{x:o.x+cell[0]+6,y:o.y+cell[1]+.75,z:o.z+cell[2]+.5},vel:{x:-30,y:0,z:0},radius:def.shot.radius,k:def.k,payload:{...def.shot,splash:0,splashRadius:0},sourceSlot:1,weaponId:3});for(let j=0;j<12;j++)sim.tick([]);const c=api.state.castles[0];damaged=c.palaceCells.filter(i=>c.plot.type[i]===11&&c.plot.hp[i]>0&&c.plot.hp[i]<getBlock(11).hp);}
 const c=api.state.castles[0],i=damaged[0],p=c.plot,target=[i%48,Math.floor(i/2304),Math.floor(i/48)%48],initial=p.hp[i];sim.tick([{type:CMD.REPAIR_PRIORITY,slot:0,tick:api.tick,seq:0,cell:target}]);let progress=null;
 for(let n=0;n<1800;n++){sim.tick([]);if(!progress&&p.hp[i]>initial)progress={tick:api.tick,hp:p.hp[i],bar:palaceStatus(c,api.tick)};if(p.hp[i]===getBlock(11).hp)break;}
 const result={target,incomingShots:shots,initial,progress,finalHp:p.hp[i],finalTick:api.tick,bar:palaceStatus(c,api.tick),jobs:c.jobs.filter(j=>j.target.cell?.join()===target.join()),materialCost:(p.hp[i]-initial)/getBlock(11).hp*(getBlock(11).cost??T.economy.mapOnlyRepairBlockCost)*T.economy.repairCostFrac};results.push(result);console.log(JSON.stringify(result));
}
writeFileSync(`${process.env.WAVE3_OUT??'tests/evidence/repair-wave-3-ui'}/palace-repair-probe.json`,JSON.stringify(results,null,2));

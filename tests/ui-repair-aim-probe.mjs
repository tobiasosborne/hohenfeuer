// owns: ten-seed, four-shot calm-wind correction probe using observed miss and a rough initial charge, no aim solver.
import {writeFileSync} from 'node:fs';
import {registerCoreSim} from '../src/plugins/index.sim.js';
import {freezeRegistries,getMap,getWeapon,CMD,EV} from '../src/contracts.js';
import {createSim} from '../src/sim/sim.js';
import {createTb1Script,tb1Slots,palaceCentre} from '../src/tb1-script.js';
import {impactOffset} from '../src/ui/battle-feedback.js';
registerCoreSim();freezeRegistries();
const results=[];
for(let seed=1;seed<=10;seed++) {
 let api;const slots=tb1Slots();slots[1].controller='local';
 const sim=createSim({map:{...getMap('forest-duel'),wind:{strength:0,change:0}},seed,slots,hooks:{onReady(a){api=a;}}});
 const walk=createTb1Script();
 while(walk.phase==='walk'&&api.tick<1000){sim.tick(walk.next(api.state));sim.drainEvents();}
 const w=api.state.weapons.filter(w=>w.slot===0)[1],target=palaceCentre(api.state.castles[1]);
 let az=Math.round(Math.atan2(target.x-w.pos.x,-(target.z-w.pos.z))*180/Math.PI)*10+20,charge=960;
 const sample={seed,distance:Math.hypot(target.x-w.pos.x,target.z-w.pos.z),shots:[]};
 const send=commands=>{sim.tick(commands.map((c,seq)=>({...c,slot:0,tick:api.tick,seq})));return sim.drainEvents();};
 send([{type:CMD.ORDER_CREW,weaponId:w.id,on:1},{type:CMD.MAN_WEAPON,weaponId:w.id}]);
 for(let n=0;n<4;n++) {
   send([{type:CMD.AIM,weaponId:w.id,az,range:charge}]);
   while(api.state.weapons.find(g=>g.id===w.id).reload<getWeapon('cannon').reloadS&&api.tick<10000)send([]);
   let events=send([{type:CMD.FIRE,weaponId:w.id}]),impact=null;
   for(let t=0;t<600;t++) {impact=events.find(e=>e.type===EV.IMPACT&&e.payload.slot===0);if(impact)break;events=send([]);}
   if(!impact){sample.failure='no impact';break;}
   const offset=impactOffset(w.pos,target,impact.payload.pos);
   const e=api.state.castles[1].plot,p=impact.payload.pos;
   const enemy=p[0]>=e.origin.x&&p[0]<e.origin.x+e.width&&p[2]>=e.origin.z&&p[2]<e.origin.z+e.depth;
   sample.shots.push({az,charge:charge/10,hit:impact.payload.hit,offset,enemy,point:p});
   // Correct direction from observed metres; bracket charge in 2-unit taps.
   az=Math.round((az-Math.atan2(offset.lateral,sample.distance)*180/Math.PI*10+3600)%3600);
   if(!enemy)charge=Math.max(10,Math.min(2550,charge+(offset.range<0?20:-20)));
 }
 sample.firstEnemyHit=sample.shots.findIndex(s=>s.enemy&&['block','weapon','person'].includes(s.hit))+1||null;
 sample.within3m=sample.shots.some(s=>Math.hypot(s.offset.range,s.offset.lateral)<=3);
 results.push(sample);
}
const report={definition:'190m-class forest duel, rough charge 96, initial bearing error +2 degrees, rounded bearing, observed lateral correction and two-charge bracketing; never calls solveAim/geometryAim in the shot policy',results,
 enemyHitWithinFour:results.filter(r=>r.firstEnemyHit!==null).length,within3m:results.filter(r=>r.within3m).length};
writeFileSync('tests/evidence/repair-wave-2-ui/aim-probe.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));

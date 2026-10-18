// owns: paired wave-2/wave-3 screen guidance against the v3 bounded 12-second planner on identical states.
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {runNovice} from './critique-v3-hooks.mjs';
import {commandFor,value} from './critique-v3-run.mjs';
import {screenAudit} from './wave3-camera.mjs';
import {localInterventions as oldPicker} from './wave3-interventions-before.mjs';
import {captureBlueprint} from '../src/ai/build.js';
import {createBattleFeedback} from '../src/ui/battle-feedback.js';
import {restoreSim} from '../src/sim/sim.js';
import {canDesignate} from '../src/npc/index.js';
import {visibleFeatures,profileForMatch} from '../src/progression.js';
import {EV,CMD} from '../src/contracts.js';
const dir=process.env.WAVE3_OUT??'tests/evidence/repair-wave-3-ui',key=a=>`${a.kind}:${a.cell?.join()??a.weaponId??''}`;
function run(job){let before,after,feedback,current=null;const rows=[],commands=[];
 const referenceDir=process.env.WAVE3_REFERENCE??'tests/evidence/critique-v3';
 const reference=JSON.parse(readFileSync(`${referenceDir}/novice.json`)).matches.find(m=>m.seed===job.seed&&m.level===job.level);
 const screenReference=JSON.parse(readFileSync(`${referenceDir}/screen-results.json`)).matches.find(m=>m.seed===job.seed&&m.level===job.level);
 let cachedRollouts=0,freshRollouts=0;
 const result=runNovice({...job,policy:'novice',compact:true,onCommands(s,c){commands.push(...c);},audit:{
  start(s){const walls=captureBlueprint(s.castles[0]).cells;before=screenAudit(s.seed,walls,{picker:oldPicker,before:true});after=screenAudit(s.seed,walls);feedback=createBattleFeedback(0);},
  tick(s,events,sim,policy){before.observe(s,events);after.observe(s,events);feedback.ingest(events,s);
   for(const e of events)if(e.type===EV.SHOT_FIRED&&e.payload.slot===0&&s.weapons.find(w=>w.id===e.payload.weaponId)?.defId==='cannon')current={start:s.tick,weaponId:e.payload.weaponId};
   if(!current||s.tick!==current.start+150)return;
   const threat=feedback.danger(s.tick),b=before.choices(s,threat,current.weaponId),a=after.choices(s,threat,current.weaponId),candidates=[{kind:'wait',cost:0},...b.actions,...a.actions];
   const p=s.castles[0].plot;
   // Same independent candidates as v3, selected with the pinned old picker so the new ranking cannot bias the oracle.
   for(const block of policy.options(s).localDamaged.slice(0,3)){
    const action=oldPicker(s,0,{features:visibleFeatures(profileForMatch(3)),blueprint:[],visible:pos=>Math.hypot(pos[0]-p.origin.x-block.cell[0]-.5,pos[1]-p.origin.y-block.cell[1]-.5,pos[2]-p.origin.z-block.cell[2]-.5)<.1})[0];
    if(action?.kind==='repair')candidates.push(action);
   }
   if(threat&&!candidates.some(a=>a.kind==='cover'))candidates.push({kind:'cover',cost:0});
   const unique=[...new Map(candidates.map(a=>[key(a),a])).values()],blob=sim.serialize(),scores=[],stateHash=sim.hash();
   const priorScreen=screenReference.windows.find(w=>Math.round(w.sampleS*30)===s.tick);
   const prior=priorScreen?.stateHash===stateHash?reference.audit.windows.find(w=>Math.round(w.sampleS*30)===s.tick):null;
   for(const action of unique){
    if(action.kind==='cover'){const q=threat?.impactPos,z=Array.isArray(q)?q[2]:q?.z??s.rulers[0].pos.z;action.yaw=s.rulers[0].pos.z>=z?32768:0;}
    const cached=prior?.solver.candidates.find(c=>key(c.action)===key(action));
    if(cached){scores.push({action,utility:cached.utility});cachedRollouts++;continue;}
    freshRollouts++;
    let api;const fork=restoreSim(blob,{hooks:{onReady(v){api=v;}}});
    for(let dt=0;dt<360&&!api.state.outcome;dt++)fork.tick(commandFor(action,api.state,dt,s.rulers[0].manning));
    scores.push({action,utility:value(api.state)});
   }
   const best=Math.max(...scores.map(s=>s.utility)),wait=scores[0].utility;
   const measure=shown=>{const selected=scores.filter(c=>shown.actions.some(a=>key(a)===key(c.action)));return {...shown,bestOffered:selected.some(c=>best-c.utility<=.05),harmfulOffers:selected.filter(c=>c.utility<wait-.05).length,beneficialOffers:selected.filter(c=>c.utility>wait+.05).length,legalFailures:shown.actions.filter(a=>a.cell&&a.kind!=='repair'&&!canDesignate(s.castles[0],{type:a.kind==='replacement'?CMD.DESIGNATE_WEAPON:CMD.DESIGNATE,cell:a.cell,weapon:a.weapon,block:a.block},s)).length};};
   rows.push({stateHash,verifiedPrior:!!prior,startS:current.start/30,sampleS:s.tick/30,positiveBest:best>wait+.05,best:scores.filter(c=>best-c.utility<=.05).map(c=>key(c.action)),before:measure(b),after:measure(a),scores:scores.map(c=>({action:c.action,gain:c.utility-wait}))});
  },
  end(s,sim,p,valid){for(let i=rows.length-1;i>=0;i--)if(!valid.some(v=>Math.abs(v.startS-rows[i].startS)<.01))rows.splice(i,1);}
 }});
 mkdirSync(`${dir}/traces`,{recursive:true});writeFileSync(`${dir}/traces/L${job.level}-seed${job.seed}.json.gz`,gzipSync(JSON.stringify(commands)));
 return {seed:job.seed,level:job.level,cachedRollouts,freshRollouts,priorHashMatches:result.hash===reference.hash,hash:result.hash,seconds:result.seconds,windows:rows,commandFile:`traces/L${job.level}-seed${job.seed}.json.gz`};
}
if(!isMainThread&&workerData?.wave3){parentPort.on('message',j=>parentPort.postMessage(run(j)));parentPort.postMessage('ready');}
else if(isMainThread){
 mkdirSync(dir,{recursive:true});const file=`${dir}/screen-partial.json`,results=existsSync(file)?JSON.parse(readFileSync(file)):[],jobs=[];
 for(const level of [2,5,8])for(let seed=1;seed<=10;seed++)if(!results.some(r=>r.seed===seed&&r.level===level))jobs.push({seed,level});
 await Promise.all(Array.from({length:Math.min(Number(process.env.WAVE3_WORKERS??2),jobs.length)},()=>new Promise((resolve,reject)=>{
  const w=new Worker(new URL(import.meta.url),{workerData:{wave3:true}});w.on('error',reject);w.on('message',r=>{if(r!=='ready'){results.push(r);writeFileSync(file,JSON.stringify(results));console.log(r.level,r.seed,r.windows.length,'windows',r.windows.filter(w=>w.after.actions.length===2).length,'two options');}const next=jobs.shift();if(next)w.postMessage(next);else{w.terminate();resolve();}});
 })));
 results.sort((a,b)=>a.level-b.level||a.seed-b.seed);writeFileSync(`${dir}/screen-results.json`,JSON.stringify({method:'Paired same-state old production frustum/mesh picker and consequence-ranked direction cues; independent v3 12-second candidates; profile 3; unchanged novice commands.',matches:results}));
 const summary=[];
 for(const level of [2,5,8])for(const version of ['before','after']){const rows=results.filter(m=>m.level===level).flatMap(m=>m.windows),positive=rows.filter(w=>w.positiveBest);summary.push({level,version,windows:rows.length,zero:rows.filter(w=>w[version].actions.length===0).length,one:rows.filter(w=>w[version].actions.length===1).length,two:rows.filter(w=>w[version].actions.length===2).length,legalFailures:rows.reduce((n,w)=>n+w[version].legalFailures,0),beneficialWindows:positive.length,bestOffered:positive.filter(w=>w[version].bestOffered).length,twoBeneficial:rows.filter(w=>w[version].beneficialOffers===2).length,harmfulOffers:rows.reduce((n,w)=>n+w[version].harmfulOffers,0)});}
 writeFileSync(`${dir}/screen-summary.json`,JSON.stringify(summary,null,2));console.log(summary);
}

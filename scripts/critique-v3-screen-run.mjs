// owns: replaying each novice cohort through production screen filters and comparing displayed actions with bounded counterfactuals.
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {runNovice} from './critique-v3-hooks.mjs';
import {commandFor,value} from './critique-v3-run.mjs';
import {screenAudit} from './critique-v3-screen.mjs';
import {captureBlueprint} from '../src/ai/build.js';
import {createBattleFeedback} from '../src/ui/battle-feedback.js';
import {restoreSim} from '../src/sim/sim.js';
import {EV} from '../src/contracts.js';
const dir='tests/evidence/critique-v3',key=a=>`${a.kind}:${a.cell?.join()??a.weaponId??''}`;
function run(prior){let screen,feedback;const rows=[],commands=[],source=new Map(prior.audit.windows.map(w=>[Math.round(w.sampleS*30),w]));
 const result=runNovice({seed:prior.seed,level:prior.level,policy:'novice',compact:true,onCommands(s,c){commands.push(...c);},audit:{
 start(s){screen=screenAudit(s.seed,captureBlueprint(s.castles[0]).cells);feedback=createBattleFeedback(0);},
 tick(s,events,sim){screen.observe(s,events);feedback.ingest(events,s);const old=source.get(s.tick);if(!old||!prior.audit.validWindows.some(v=>Math.abs(v.startS-old.startS)<.01))return;
  const shown=screen.choices(s,feedback.danger(s.tick),old.weaponId),scores=old.solver.candidates.map(c=>({...c}));let extra=0;
  for(const action of shown.actions)if(!scores.some(c=>key(c.action)===key(action))){const blob=sim.serialize();let api;const fork=restoreSim(blob,{hooks:{onReady(a){api=a;}}});for(let dt=0;dt<360&&!api.state.outcome;dt++)fork.tick(commandFor(action,api.state,dt,s.rulers[0].manning));scores.push({action,utility:value(api.state)});extra++;}
  const best=Math.max(...scores.map(c=>c.utility)),wait=scores.find(c=>c.action.kind==='wait').utility,shownScores=scores.filter(c=>shown.actions.some(a=>key(a)===key(c.action)));
  rows.push({stateHash:sim.hash(),startS:old.startS,sampleS:old.sampleS,...shown,extraRollouts:extra,positiveBest:best>wait+.05,best:scores.filter(c=>best-c.utility<=.05).map(c=>key(c.action)),bestOffered:shownScores.some(c=>best-c.utility<=.05),regret:best-Math.max(wait,...shownScores.map(c=>c.utility)),harmfulOffers:shownScores.filter(c=>c.utility<wait-.05).length,headlessPrompt:old.prompt.map(key)});
 }
 }});
 if(result.hash!==prior.hash)throw Error(`screen replay changed ${prior.level}/${prior.seed}: ${result.hash} != ${prior.hash}`);
 mkdirSync(`${dir}/traces`,{recursive:true});writeFileSync(`${dir}/traces/L${prior.level}-seed${prior.seed}.json.gz`,gzipSync(JSON.stringify(commands)));
 return {seed:prior.seed,level:prior.level,hash:result.hash,seconds:result.seconds,windows:rows,commandFile:`traces/L${prior.level}-seed${prior.seed}.json.gz`};
}
if(!isMainThread&&workerData?.screenV3){parentPort.on('message',j=>parentPort.postMessage(run(j)));parentPort.postMessage('ready');}
else if(isMainThread){
 const file=`${dir}/screen-partial.json`,results=existsSync(file)?JSON.parse(readFileSync(file)):[],busy=new Set(),ready=[],workers=[];
 for(let i=0;i<3;i++){const w=new Worker(new URL(import.meta.url),{workerData:{screenV3:true}});workers.push(w);w.on('error',e=>{console.error(e);process.exit(1);});w.on('message',r=>{if(r!=='ready'){results.push(r);busy.delete(r.level+'/'+r.seed);writeFileSync(file,JSON.stringify(results));console.log(r.level,r.seed,r.windows.length,'windows',r.windows.filter(w=>w.actions.length).length,'with displayed alternatives');}ready.push(w);});}
 while(results.length<30){const available=[];for(const name of ['novice-partial','novice-upper-partial','novice'])try{const d=JSON.parse(readFileSync(`${dir}/${name}.json`));available.push(...(d.matches??d));}catch{}
  const unique=[...new Map(available.map(r=>[r.level+'/'+r.seed,r])).values()].filter(r=>[2,5,8].includes(r.level)&&!busy.has(r.level+'/'+r.seed)&&!results.some(s=>s.level===r.level&&s.seed===r.seed));
  while(ready.length&&unique.length){const j=unique.shift();busy.add(j.level+'/'+j.seed);ready.shift().postMessage(j);}await new Promise(r=>setTimeout(r,3000));
 }
 workers.forEach(w=>w.terminate());results.sort((a,b)=>a.level-b.level||a.seed-b.seed);writeFileSync(`${dir}/screen-results.json`,JSON.stringify({method:'production frustum and cannon mesh triangles; input look synchronized with command ruler yaw/pitch; 12-second bounded counterfactuals',matches:results}));
}

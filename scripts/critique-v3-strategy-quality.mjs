// owns: causal replays of all seven morale-pressure victories, separating surrender triggers, exposed rulers and collateral/fall endings.
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {readFileSync,writeFileSync} from 'node:fs';
import {runNovice} from './critique-v3-hooks.mjs';
import {strategy,endingAudit} from './critique-v3-run.mjs';
const dir='tests/evidence/critique-v3';
if(!isMainThread&&workerData?.qualityV3){parentPort.on('message',j=>{const audit=endingAudit();let p;const r=runNovice({seed:j.seed,level:5,policy:'morale-pressure',compact:true,audit,policyFactory:(s,n,o)=>(p=strategy(s,n,o))});if(r.hash!==j.hash)throw Error('Strategy replay changed');parentPort.postMessage({seed:j.seed,hash:r.hash,seconds:r.seconds,winner:r.winner,reason:r.reason,targetOrders:p.counts,audit:audit.out});});parentPort.postMessage('ready');}
else if(isMainThread){const jobs=JSON.parse(readFileSync(`${dir}/strategies.json`)).matches.filter(m=>m.policy==='morale-pressure'&&m.winner===0),results=[];
 await Promise.all(Array.from({length:2},()=>new Promise((res,rej)=>{const w=new Worker(new URL(import.meta.url),{workerData:{qualityV3:true}});w.on('error',rej);w.on('message',r=>{if(r!=='ready'){results.push(r);writeFileSync(`${dir}/strategy-quality-partial.json`,JSON.stringify(results));console.log(r.seed,r.reason,r.audit.deaths.map(d=>({leadership:d.leadershipDone,cause:d.cause,manning:d.before?.manning})));}const j=jobs.shift();if(j)w.postMessage(j);else{w.terminate();res();}});})));writeFileSync(`${dir}/strategy-quality.json`,JSON.stringify({matches:results}));
}

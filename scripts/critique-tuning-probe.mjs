// owns: isolated in-memory numeric counterfactuals; never writes production source or tuning.
import { registerHooks } from 'node:module';
import { Worker,isMainThread,parentPort,workerData } from 'node:worker_threads';
import { writeFileSync } from 'node:fs';
const dir='tests/evidence/critique-v2';
if(!isMainThread){
  const radius=workerData.radius,morale=workerData.morale,pop=workerData.pop;
  registerHooks({load(url,context,nextLoad){const result=nextLoad(url,context);
    if(url.endsWith('/src/tuning.js')){const source=String(result.source),needle='rulerDangerM: 10,';
      if(!source.includes(needle))throw Error('Tuning anchor changed');let edited=source.replace(needle,`rulerDangerM: ${radius},`);
      if(morale!==null&&morale!==undefined){if(!edited.includes('surrenderMorale: 10,'))throw Error('Morale anchor changed');edited=edited.replace('surrenderMorale: 10,',`surrenderMorale: ${morale},`);}
      if(pop!==null&&pop!==undefined){if(!edited.includes('surrenderPopFrac: 0.25,'))throw Error('Population anchor changed');edited=edited.replace('surrenderPopFrac: 0.25,',`surrenderPopFrac: ${pop},`);}
      return {...result,source:edited};}
    return result;
  }});
  const {runMatch}=await import('./sweep.mjs');
  const m=runMatch({index:workerData.seed-1,seed:workerData.seed,swap:false,levels:[5,5],map:'forest-duel',maxMinutes:20});
  parentPort.postMessage({radius,morale,pop,...m});
}else{
  const args=process.argv.slice(2),get=(k,d)=>args.includes(k)?args[args.indexOf(k)+1]:d;
  const radii=get('--radii','4,0').split(',').map(Number),seeds=Number(get('--seeds','10')),workers=Number(get('--workers','4')),label=get('--label','ruler-tuning'),morale=args.includes('--morale')?Number(get('--morale')):null,pop=args.includes('--pop')?Number(get('--pop')):null;
  const jobs=radii.flatMap(radius=>Array.from({length:seeds},(_,i)=>({radius,seed:i+1,morale,pop}))),matches=[];
  await Promise.all(Array.from({length:workers},async()=>{for(;;){const job=jobs.shift();if(!job)return;
    const m=await new Promise((resolve,reject)=>{const w=new Worker(new URL(import.meta.url),{workerData:job});w.on('message',resolve);w.on('error',reject);});
    matches.push(m);writeFileSync(`${dir}/${label}-partial.json`,JSON.stringify(matches));console.log(`radius${m.radius} seed${m.seed}: ${m.seconds.toFixed(1)}s ${m.eliminationReason}`);
  }}));
  writeFileSync(`${dir}/${label}.json`,JSON.stringify({method:'In-memory rulerDangerM and optional surrenderMorale overrides via node registerHooks; no src edits',matches},null,2));
}

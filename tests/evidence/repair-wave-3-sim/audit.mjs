// owns: reproducible wave-three observation-only workers and compact causal summaries.
import {registerHooks} from 'node:module';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const args=process.argv.slice(2),get=(k,d)=>args.includes(k)?args[args.indexOf(k)+1]:d;
const root=workerData?.root??resolve(get('--root','.'));
const url=p=>pathToFileURL(`${root}/${p}`).href;
const replace=(s,a,b)=>{if(!s.includes(a))throw Error('Missing audit hook '+a);return s.replace(a,b);};
registerHooks({load(u,c,next){const r=next(u,c);let s=String(r.source??'');
 if(u===url('src/sim/sim.js'))s=replace(s,'get state() { return snapshot(state); },','get auditAi() { return aiController?.auditMemory; }, get state() { return snapshot(state); },');
 if(u===url('src/ai/controller.js'))s=replace(s,'return { think: (view, slot, rng) =>','return { get auditMemory() { return memory; }, think: (view, slot, rng) =>');
 if(u===url('scripts/sweep.mjs'))for(const [a,b]of [
 ['export function runMatch(job, onProgress = () => {}) {','export function runMatch(job, onProgress = () => {}, audit = {}) {'],
 ['C.resetRegistriesForTests(); registerCoreSim(); C.freezeRegistries();','C.resetRegistriesForTests(); registerCoreSim(); audit.register?.(); C.freezeRegistries();'],
 ['const map = { ...base, slots: job.swap ? [...base.slots].reverse() : [...base.slots] };','const map = { ...base, slots: job.swap ? [...base.slots].reverse() : [...base.slots] }; audit.map?.(map);'],
 ['onReady(a) { api = a; }, onStage(stage)','onReady(a) { api = a; audit.setup?.(a); }, onStage(stage)'],
 ['minuteCurve.push(record());\n  for','minuteCurve.push(record()); audit.start?.(api.state, sim);\n  for'],
 ['const events = sim.drainEvents(), losses = [];','const events = sim.drainEvents(), losses = []; audit.tick?.(state, events, sim);'],
 ['return { ...job, fireGaps','audit.end?.(state, sim); return { ...job, fireGaps']])s=replace(s,a,b);
 if(u===url('scripts/novice.mjs'))for(const [a,b]of [
 ['reactToThreats=true}) {','reactToThreats=true,audit={}}) {'],
 ['paths.sample(api.state,events);','paths.sample(api.state,events); audit.tick?.(api.state,events,sim,p,cmds);'],
 ['if(!isMainThread&&workerData){','if(!isMainThread&&workerData===true){']])s=replace(s,a,b);
 return s===String(r.source??'')?r:{...r,source:s};}});
const C=await import(url('src/contracts.js')),{runMatch}=await import(url('scripts/sweep.mjs')),{runNovice}=await import(url('scripts/novice.mjs'));
const {palaceIntegrity}=await import(url('src/sim/rules.js'));
const {palaceCentre}=await import(url('src/tb1-script.js'));
function windows(rows,side){let left=0;const all=[];for(let right=0;right<rows.length;right++){
 while(Math.max(...rows.slice(left,right+1).map(r=>r.palace[side]))-Math.min(...rows.slice(left,right+1).map(r=>r.palace[side]))>=.02)left++;
 if(rows[right].second-rows[left].second>180)all.push([left,right]);
 }return all.filter((w,i)=>i===all.length-1||all[i+1][0]>w[0]);}
function observer(){const rows=[],route=[],actions=[],launches=[],deaths=[],repairBeats=[],prev=[],knownHp=[];let repair=[0,0],lastShots=[-Infinity,-Infinity];
 const out={route,actions,launches,deaths,repairBeats};return {out,tick(s,events,sim,_policy,cmds){
  const now=s.tick/30; if(!knownHp.length){for(const c of s.castles)knownHp.push(c.plot.hp.slice());out.proxyTarget=palaceCentre(s.castles[1]);}
  for(const e of events){const p=e.payload;if([C.EV.BLOCK_DESTROYED,C.EV.BLOCK_BUILT].includes(e.type)&&p.cell){const c=s.castles[p.plot],i=p.cell[0]+c.plot.width*p.cell[2]+c.plot.width*c.plot.depth*p.cell[1];knownHp[p.plot][i]=c.plot.hp[i];}
   if(e.type===C.EV.SHOT_FIRED){lastShots[p.slot]=now;const m=sim.auditAi?.slots.find(a=>a.id===p.slot)?.weapons.find(w=>w.id===p.weaponId);launches.push({second:now,slot:p.slot,weapon:p.weaponId,target:m?.shotTarget?.kind??m?.target?.kind??'proxy-palace',aim:{...s.weapons.find(w=>w.id===p.weaponId)?.aim},pos:m?.shotTarget?.pos??m?.target?.pos??out.proxyTarget,projectileId:s.projectiles.findLast(q=>q.weaponId===p.weaponId)?.id});}
   if(e.type===C.EV.BLOCK_DAMAGED){const c=s.castles[p.plot],i=p.cell[0]+c.plot.width*p.cell[2]+c.plot.width*c.plot.depth*p.cell[1],before=knownHp[p.plot]?.[i];if(before!==undefined&&p.hp>before){repair[p.plot]+=p.hp-before;if(p.id===C.BLOCK.PALACE&&repairBeats.length<20)repairBeats.push({second:now,slot:p.plot,cell:p.cell,before,after:p.hp});}knownHp[p.plot][i]=p.hp;}
   if(e.type===C.EV.RULER_DIED)deaths.push({second:now,...p,launch:launches.findLast(l=>l.projectileId===p.projectileId)??null});
  }
  const ai=sim.auditAi;
  for(const r of s.rulers){const old=prev[r.slot],m=ai?.slots.find(a=>a.id===r.slot),key=JSON.stringify([r.manning,!!m?.rulerDuty,m?.leadershipActive??null,!!m?.rulerPath,m?.rulerPath?.[0]]);
   if(key!==old?.routeKey&&(m?.leadershipDone||r.manning!==null||old?.manning!==null&&old))route.push({second:now,slot:r.slot,pos:{...r.pos},manning:r.manning,hp:r.hp,duty:m?.rulerDuty,active:m?.leadershipActive,pathNext:m?.rulerPath?.[0],pathLength:m?.rulerPath?.length,nav:s.castles[r.slot].plot.navVersion});
   prev[r.slot]={routeKey:key,manning:r.manning};
  }
  if(cmds?.length)for(const c of cmds)if(c.type!==C.CMD.MOVE||c.fwd||c.strafe)if(![C.CMD.AIM].includes(c.type)){
   const r=s.rulers[0],w=s.weapons.find(w=>w.id===(c.weaponId??r.manning)),key=[c.type,c.weaponId,c.cell?.join(),c.fwd,c.yaw].join('/');
   if(actions.at(-1)?.key!==key||now-actions.at(-1).second>30)actions.push({key,second:now,command:c,pos:{...r.pos},manning:r.manning,gun:w?{id:w.id,hp:w.hp,idle:w.idleReason,crew:w.crewPresent,ammo:w.ammo}:null});
  }
  if(s.tick%30===0)rows.push({second:now,palace:s.castles.map(palaceIntegrity),sides:s.castles.map((c,i)=>{const r=s.rulers[i],guns=s.weapons.filter(w=>w.slot===i&&w.hp>0),target=ai?.slots.find(a=>a.id===i)?.weapons.map(w=>w.target?.kind??null);return {shots:c.stats.shots,firing:now-lastShots[i]<=30,gunCrisis:!guns.some(w=>!['no-crew','no-ammo','damaged','obstructed'].includes(w.idleReason)),population:c.population,populationCrisis:c.population<c.initialPopulation*.6,rulerCrisis:r.hp<100||r.manning!==null||!!ai?.slots.find(a=>a.id===i)?.rulerDuty,repair:repair[i],repairWorking:(c.jobs??[]).some(j=>j.kind===C.JOB.REPAIR&&j.claimedBy?.length),idle:guns.map(w=>w.idleReason),target,pos:{...r.pos},manning:r.manning};})});
 },end(s){const loser=s.outcome?.winners?.length===1?1-s.outcome.winners[0]:null;
 out.final={rulers:s.rulers,weapons:s.weapons.map(w=>({id:w.id,slot:w.slot,pos:w.pos,hp:w.hp,idle:w.idleReason,crew:w.crewPresent,ammo:w.ammo})),palace:s.castles.map(palaceIntegrity)};
 const eligible=rows.filter(r=>r.second>=120);
 out.plateaus=s.castles.map((c,side)=>({side,loser:side===loser,windows:windows(eligible,side).map(([a,b])=>{const rr=eligible.slice(a,b+1),n=rr.length,ss=rr.map(r=>r.sides[side]);return {startS:rr[0].second,endS:rr.at(-1).second,seconds:rr.at(-1).second-rr[0].second,palaceMin:Math.min(...rr.map(r=>r.palace[side])),palaceMax:Math.max(...rr.map(r=>r.palace[side])),shots:ss.at(-1).shots-ss[0].shots,enemyShots:rr.at(-1).sides[1-side].shots-rr[0].sides[1-side].shots,population:[ss[0].population,ss.at(-1).population],repairHp:ss.at(-1).repair-ss[0].repair,shares:Object.fromEntries(['firing','gunCrisis','populationCrisis','rulerCrisis','repairWorking'].map(k=>[k,ss.filter(r=>r[k]).length/n])),inactiveShare:ss.filter(r=>!r.firing&&!r.gunCrisis&&!r.populationCrisis&&!r.rulerCrisis&&!r.repairWorking).length/n,targetKinds:[...new Set(ss.flatMap(r=>r.target??[]))]};})}));
 out.snapshots=rows.filter((r,i)=>i%60===0||i===rows.length-1).map(r=>({second:r.second,palace:r.palace,sides:r.sides}));
 }};}
function execute(j){const a=makeObserver();if(j.mode==='novice'){const r=runNovice({...j,policy:'novice',maxMinutes:20,compact:true,audit:a});a.finish();return {...r,audit:a.out};}
 const r=runMatch({...j,map:'forest-duel',maxMinutes:20,levels:j.levels??[5,5],physicalLevels:j.levels??[5,5],compact:true},()=>{},a);return {...r,audit:a.out};}
// Novice has no audit.end baseline hook; retain the last state without changing its policy.
const originalObserver=observer;
function makeObserver(){const a=originalObserver(),tick=a.tick,end=a.end;a.tick=(s,...rest)=>{a.last=s;tick(s,...rest);};a.finish=()=>end(a.last);return a;}
async function main(){const dir=get('--output-dir','tests/evidence/repair-wave-3-sim'),label=get('--label','audit'),mode=get('--mode','sweep'),count=Number(get('--seeds','20')),start=Number(get('--seed-start','1')),levels=get('--levels',mode==='novice'?'2,5,8':'5').split(',').map(Number),selected=get('--seed-list','').split(',').filter(Boolean).map(Number),jobs=[];
 for(const level of levels)for(let seed=start;seed<start+count;seed++)if(!selected.length||selected.includes(seed))for(const swap of mode==='novice'||args.includes('--no-swap')?[false]:[false,true])jobs.push({mode,seed,level,levels:[level,level],swap,root});
 mkdirSync(dir,{recursive:true});mkdirSync(`${dir}/${label}-matches`,{recursive:true});const results=[];
 await Promise.all(Array.from({length:Math.min(Number(get('--workers','3')),jobs.length)},()=>new Promise((done,fail)=>{const w=new Worker(new URL(import.meta.url),{workerData:{audit:true,root}});w.on('error',fail);w.on('message',r=>{if(r!=='ready'){const path=`${label}-matches/L${r.level}-s${r.seed}-${r.swap?'reverse':'normal'}.json`;writeFileSync(`${dir}/${path}`,JSON.stringify(r));const {audit,...summary}=r;results.push({...summary,auditPath:path});writeFileSync(`${dir}/${label}-partial.json`,JSON.stringify(results));console.log(`${mode} L${r.level} seed${r.seed} swap${r.swap}: ${r.seconds}s ${r.eliminationReason??r.reason} ${r.hash}`);}const j=jobs.shift();if(j)w.postMessage(j);else {w.terminate();done();}});})));writeFileSync(`${dir}/${label}.json`,JSON.stringify({root,matches:results}));}
if(!isMainThread&&workerData?.audit){parentPort.on('message',j=>parentPort.postMessage(execute(j)));parentPort.postMessage('ready');}else if(process.argv[1]===fileURLToPath(import.meta.url))await main();

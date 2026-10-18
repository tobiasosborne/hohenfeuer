// owns: v3 read-only audit workers, strategy policies, bounded reload planning and paired environment interventions.
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as C from '../src/contracts.js';
import {TUNING as T} from '../src/tuning.js';
import {runMatch,runNovice,createPolicy} from './critique-v3-hooks.mjs';
import {restoreSim} from '../src/sim/sim.js';
import {shooterPosition,visibleTarget} from '../src/ai/view.js';
import {geometryAim} from '../src/ai/aim.js';
import {windVector} from '../src/sim/wind.js';
import {captureBlueprint} from '../src/ai/build.js';
import {palaceIntegrity} from '../src/sim/rules.js';
import {localInterventions} from '../src/player/interventions.js';
import {visibleFeatures,profileForMatch} from '../src/progression.js';
import {createBattleFeedback,pressureText} from '../src/ui/battle-feedback.js';
import {canDesignate} from '../src/npc/index.js';
const dir='tests/evidence/critique-v3';
const aiState=sim=>JSON.parse(Buffer.from(sim.serialize()).toString('utf16le')).ai;
const eq=(a,b)=>a?.join()===b?.join();
const key=a=>`${a.kind}:${a.cell?.join()??a.weaponId??''}`;
const yawTo=(r,p)=>(Math.round(Math.atan2(p.x-r.pos.x,-(p.z-r.pos.z))/(2*Math.PI)*65536)+65536)%65536;
function exposed(s,slot){const r=s.rulers[slot],target={slot,pos:{...r.pos,y:r.pos.y+.875}};return s.weapons.some(w=>w.slot!==slot&&w.hp>0&&visibleTarget(s,shooterPosition(w,target.pos),target));}
function environment(condition){return {
 register(){if(condition==='mirror'){
  const d=C.getCastle('default'),point=p=>[47-p[0],...p.slice(1)],facing=n=>(4-n)%4;
  C.registerCastle({...d,id:'v3-reflected',layers:d.layers.map(l=>l.map(r=>[...r].reverse().join(''))),
   weapons:d.weapons.map(w=>({...w,at:point(w.at),facing:facing(w.facing)})),
   mountSpots:d.mountSpots.map(p=>[47-p[0],p[1],p[2],facing(p[3])]),
   shelters:d.shelters.map(p=>[47-p[3],p[1],p[2],47-p[0],p[4],p[5]]),workSpots:d.workSpots.map(point),
   rulerSpawn:point(d.rulerSpawn),throne:point(d.throne),exit:point(d.exit)});
 }},
 map(map){if(condition==='mirror')map.slots=map.slots.map((s,i)=>i===1?{...s,castle:'v3-reflected'}:s);},
 setup(api){
 const s=api.state;
 if(condition.includes('terrain'))for(const name of ['heights','baseHeights']){const f=s.terrain,old=f[name].slice();for(let z=0;z<f.depth;z++)for(let x=0;x<f.width;x++)f[name][x+z*f.width]=old[f.width-1-x+z*f.width];}
 if(condition.includes('wind')){const w=s.wind;w.direction=(360-w.direction)%360;w.schedule=w.schedule.map(d=>(360-d)%360);w.segments=w.segments.map(e=>({...e,direction:(360-e.direction)%360}));}
 if(condition==='calm')s.wind.speed=0;
 }};}
export function endingAudit(){const out={threats:[],deaths:[],surrender:[],firstHit:null},previous=[];return {out,
 tick(s,events,sim){
  const important=events.some(e=>[C.EV.RULER_DIED,C.EV.RULER_THREAT].includes(e.type));
  const ai=important?aiState(sim):null;
  for(const e of events){const p=e.payload;
   if(!out.firstHit&&[C.EV.NPC_DIED,C.EV.BLOCK_DAMAGED].includes(e.type)&&Number.isInteger(p.sourceSlot)&&p.sourceSlot!==(p.castle??p.plot))out.firstHit={second:s.tick/30,attacker:p.sourceSlot,victim:p.castle??p.plot};
   if(e.type===C.EV.RULER_THREAT){const r=s.rulers[p.castle],a=ai.slots.find(a=>a.id===p.castle);out.threats.push({second:s.tick/30,...p,ruler:{pos:{...r.pos},manning:r.manning,exposed:exposed(s,p.castle)},leadershipDone:a?.leadershipDone??false,duty:a?.rulerDuty??null,leadershipActive:a?.leadershipActive??null});}
   if(e.type===C.EV.RULER_DIED){const a=ai.slots.find(a=>a.id===p.slot);out.deaths.push({second:s.tick/30,...p,before:previous[p.slot],leadershipDone:a?.leadershipDone??false,duty:a?.rulerDuty??null,leadershipActive:a?.leadershipActive??null,matchingWarning:out.threats.findLast(t=>t.projectileId===p.projectileId)??null});}
   if(e.type===C.EV.CASTLE_ELIMINATED&&p.reason==='surrender'){const c=s.castles[p.slot];out.surrender.push({second:s.tick/30,slot:p.slot,pressure:c.pressure,surrender:c.surrender,text:pressureText(c,'en'),dominant:c.pressure.filter(p=>p.weight<0).sort((a,b)=>a.weight-b.weight)[0]??null});}
  }
  for(const r of s.rulers)if(r.hp>0)previous[r.slot]={pos:{...r.pos},manning:r.manning,exposed:important?exposed(s,r.slot):null};
 }};}
export function strategy(initial,name,opts){
 const base=createPolicy(initial,'fire-only',opts),counts={ruler:0,crew:0,civilian:0,palace:0},baseNext=base.next;
 return {...base,counts,next(s,opt){let cmds=baseNext(s,opt);if(s.tick%30)return cmds;
  for(const cmd of cmds.filter(c=>c.type===C.CMD.AIM)){
   const w=s.weapons.find(w=>w.id===cmd.weaponId),enemy=s.rulers[1];let target=null,kind='palace';
   if(name==='ruler-sniping'&&enemy.hp>0){const pos={...enemy.pos,y:enemy.pos.y+.875};if(visibleTarget(s,shooterPosition(w,pos),{slot:1,pos})){target=pos;kind='ruler';}}
   if(name==='morale-pressure'){
    const people=s.npcs.filter(n=>(n.slot??n.castle)===1&&n.hp>0&&!n.deserted&&[C.ROLE.CREW,C.ROLE.CIVILIAN].includes(n.role));
    const candidates=people.map(n=>{const pos={...n.pos,y:n.pos.y+.875},near=people.filter(m=>Math.hypot(m.pos.x-n.pos.x,m.pos.y-n.pos.y,m.pos.z-n.pos.z)<4.7).length;return {n,pos,near,visible:visibleTarget(s,shooterPosition(w,pos),{slot:1,pos})};});
    candidates.sort((a,b)=>Number(b.visible)-Number(a.visible)||b.near-a.near||Number(b.n.role===C.ROLE.CREW)-Number(a.n.role===C.ROLE.CREW)||a.n.id-b.n.id);
    if(candidates[0]){target=candidates[0].pos;kind=candidates[0].n.role;}
   }
   if(target){const from=shooterPosition(w,target);from.y=w.pos.y+.5;const a=geometryAim(from,target,C.getWeapon(w.defId),windVector(s.wind));cmd.az=(Math.round(a.azDeg*10)+3600)%3600;cmd.range=Math.max(10,Math.min(2550,Math.round(a.dial*10)));}
   if(cmds.some(c=>c.type===C.CMD.FIRE&&c.weaponId===w.id))counts[kind]=(counts[kind]??0)+1;
  }return cmds;}
 };
}
export function commandFor(a,s,elapsed,original){
 const r=s.rulers[0],out=[],emit=(type,fields={})=>out.push({type,slot:0,tick:s.tick,seq:out.length,...fields});
 if(a.kind==='wait')return out;
 if(elapsed===0&&r.manning!==null)emit(C.CMD.LEAVE_WEAPON);
 if(a.kind==='cover'){
  if(elapsed<40)emit(C.CMD.MOVE,{fwd:127,strafe:0,yaw:a.yaw,pitch:0,sprint:1,jump:0});
  else if(elapsed===40)emit(C.CMD.MOVE,{fwd:0,strafe:0,yaw:a.yaw,pitch:0,sprint:0,jump:0});
  return out;
 }
 if(elapsed===15&&a.pos){const eye={...r.pos,y:r.pos.y+T.ruler.eye},p={x:a.pos[0],y:a.pos[1],z:a.pos[2]};emit(C.CMD.MOVE,{fwd:0,strafe:0,yaw:yawTo(r,p),pitch:Math.round(Math.atan2(p.y-eye.y,Math.hypot(p.x-eye.x,p.z-eye.z))/(Math.PI/2)*C.K.PITCH_LIMIT),sprint:0,jump:0});}
 if(elapsed===30){
  if(a.kind==='repair')emit(C.CMD.REPAIR_PRIORITY,{cell:a.cell});
  if(a.kind==='build')emit(C.CMD.DESIGNATE,{cell:a.cell,block:C.BLOCK.STONE,facing:0});
  if(a.kind==='replacement')emit(C.CMD.DESIGNATE_WEAPON,{cell:a.cell,weapon:'cannon',facing:1});
  if(a.kind==='crew'||a.kind==='man')emit(C.CMD.ORDER_CREW,{weaponId:a.weaponId,on:1});
 }
 if(elapsed===45&&original!==null)emit(C.CMD.MAN_WEAPON,{weaponId:original});
 return out;
}
export function value(s){const c=s.castles[0],r=s.rulers[0];return (r.hp>0?1e6:0)+(c.eliminated?-1e5:0)+10000*palaceIntegrity(c)+100*c.population+20*c.morale+c.gold*.01+s.weapons.filter(w=>w.slot===0&&w.hp>0).reduce((v,w)=>v+200+w.hp*2+w.reload,0)+c.plot.hp.reduce((v,h)=>v+(h===255?0:h),0)*.01;}
function planner(sim,s,prompt,opt,threat){
 const p=s.castles[0].plot,r=s.rulers[0],candidates=[{kind:'wait',cost:0},...prompt];
 // Independent candidates from the old opportunity enumerator, revalidated with the real picker.
 const f=visibleFeatures(profileForMatch(3));
 for(const b of opt.localDamaged.slice(0,3)){
  const a=localInterventions(s,0,{features:f,blueprint:[],visible:pos=>Math.hypot(pos[0]-p.origin.x-b.cell[0]-.5,pos[1]-p.origin.y-b.cell[1]-.5,pos[2]-p.origin.z-b.cell[2]-.5)<.1})[0];
  if(a?.kind==='repair')candidates.push(a);
 }
 if(threat&&!candidates.some(a=>a.kind==='cover'))candidates.push({kind:'cover',cost:0});
 const unique=[...new Map(candidates.map(a=>[key(a),a])).values()];
 for(const a of unique)if(a.kind==='cover'){
   const q=threat?.impactPos??[r.pos.x,r.pos.y,r.pos.z],z=Array.isArray(q)?q[2]:q.z,sign=r.pos.z>=z?1:-1;a.yaw=sign>0?32768:0;
 }
 const blob=sim.serialize(),scores=[];
 // 12 seconds: measures imminent survival and a complete full-strength repair; not long-term win optimality.
 for(const a of unique){let api;const fork=restoreSim(blob,{hooks:{onReady(v){api=v;}}});
  for(let dt=0;dt<360&&!api.state.outcome;dt++)fork.tick(commandFor(a,api.state,dt,r.manning));
  scores.push({action:a,utility:value(api.state),hp:api.state.rulers[0].hp,palace:palaceIntegrity(api.state.castles[0]),gold:api.state.castles[0].gold});
 }
 const best=Math.max(...scores.map(a=>a.utility)),wait=scores[0].utility,tolerance=.05;
 return {horizonS:12,candidates:scores,best:scores.filter(a=>best-a.utility<=tolerance).map(a=>key(a.action)),positiveBest:best>wait+tolerance,promptBest:prompt.some(a=>scores.some(b=>key(a)===key(b.action)&&best-b.utility<=tolerance)),allLegal:prompt.every(a=>!a.cell||a.kind==='repair'||canDesignate(s.castles[0],{type:a.kind==='replacement'?C.CMD.DESIGNATE_WEAPON:C.CMD.DESIGNATE,cell:a.cell,weapon:a.weapon,block:a.block},s)),regret:best-Math.max(wait,...scores.filter(a=>prompt.some(p=>key(p)===key(a.action))).map(a=>a.utility))};
}
function noviceAudit(){let walls,feedback,current=null;const windows=[],ends=endingAudit();return {out:{windows,ending:ends.out},start(s){walls=captureBlueprint(s.castles[0]).cells;feedback=createBattleFeedback(0);},tick(s,events,sim,p,cmds){
 feedback.ingest(events,s);ends.tick(s,events,sim);
 for(const e of events)if(e.type===C.EV.SHOT_FIRED&&e.payload.slot===0&&s.weapons.find(w=>w.id===e.payload.weaponId)?.defId==='cannon')current={start:s.tick,weaponId:e.payload.weaponId};
 if(current&&s.tick===current.start+150){const threat=feedback.danger(s.tick),prompt=localInterventions(s,0,{features:visibleFeatures(profileForMatch(3)),blueprint:walls,threatened:!!threat});
  const solve=planner(sim,s,prompt,p.options(s),threat);windows.push({startS:current.start/30,sampleS:s.tick/30,weaponId:current.weaponId,manning:s.rulers[0].manning,prompt,solver:solve});
 }
 },end(s,sim,p,valid){this.out.validWindows=valid;this.out.final={ruler:s.rulers[0],weapons:s.weapons.filter(w=>w.slot===0).map(w=>({id:w.id,hp:w.hp,crew:w.crewPresent,ammo:w.ammo,reason:w.idleReason,pos:w.pos})),pressure:s.castles.map(c=>c.pressure)};}};}
function execute(j){
 if(j.mode==='novice'){const audit=noviceAudit();const r=runNovice({...j,policy:'novice',compact:true,audit});return {...r,audit:audit.out};}
 if(j.mode==='strategy'){let p;const special=['ruler-sniping','morale-pressure'].includes(j.policy);const r=runNovice({...j,compact:true,policyFactory:special?(s,n,o)=>(p=strategy(s,n,o)):createPolicy});return {...r,targetOrders:p?.counts};}
 const audit=endingAudit(),env=environment(j.condition??'baseline');const r=runMatch({...j,map:'forest-duel',maxMinutes:20,levels:[5,5],physicalLevels:[5,5],swap:false,compact:true},()=>{},{...env,tick:audit.tick});return {...r,audit:audit.out};
}
async function main(){const args=process.argv.slice(2),get=(k,d)=>args.includes(k)?args[args.indexOf(k)+1]:d,mode=get('--mode','audit'),n=Number(get('--seeds','20')),workers=Number(get('--workers','4')),label=get('--label',mode),jobs=[];
 if(mode==='strategy')for(const policy of get('--policies','turtle,fire-only,ballista-spam,rebuild-lane,recovery-mounts,ruler-hiding,ruler-sniping,morale-pressure').split(','))for(let seed=1;seed<=n;seed++)jobs.push({mode,seed,level:5,policy});
 else if(mode==='novice')for(const level of get('--levels','2,5,8').split(',').map(Number))for(let seed=1;seed<=n;seed++)jobs.push({mode,seed,level});
 else for(const condition of get('--conditions',mode==='audit'?'baseline':'terrain,wind,terrain-wind,calm').split(','))for(let seed=1;seed<=n;seed++)jobs.push({mode,seed,condition});
 mkdirSync(dir,{recursive:true});const results=args.includes('--resume')?JSON.parse(readFileSync(`${dir}/${label}-partial.json`)):[];
 const selectedSeeds=get('--seed-list','').split(',').filter(Boolean).map(Number);if(selectedSeeds.length)for(let i=jobs.length-1;i>=0;i--)if(!selectedSeeds.includes(jobs[i].seed))jobs.splice(i,1);
 const identity=j=>[j.mode,j.seed,j.level,j.policy??(j.mode==='novice'?'novice':undefined),j.condition].join('/');const pending=jobs.filter(j=>!results.some(r=>identity(r)===identity(j)));
 await Promise.all(Array.from({length:Math.min(workers,pending.length)},()=>new Promise((res,rej)=>{const w=new Worker(new URL(import.meta.url),{workerData:{critiqueV3:true}});w.on('error',rej);w.on('message',r=>{if(r!=='ready'){results.push(r);writeFileSync(`${dir}/${label}-partial.json`,JSON.stringify(results));console.log(identity(r),r.seconds,r.eliminationReason??r.reason,r.winnerSlot??r.winner);}const j=pending.shift();if(j)w.postMessage(j);else{w.terminate();res();}});})));results.sort((a,b)=>identity(a).localeCompare(identity(b)));writeFileSync(`${dir}/${label}.json`,JSON.stringify({method:'scripts/critique-v3-run.mjs',matches:results}));
}
if(!isMainThread&&workerData?.critiqueV3){parentPort.on('message',j=>parentPort.postMessage({...j,...execute(j)}));parentPort.postMessage('ready');}
else if(process.argv[1]===fileURLToPath(import.meta.url))await main();

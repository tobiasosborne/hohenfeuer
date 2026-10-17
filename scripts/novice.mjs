// owns: command-only novice and strategy probes, reload decision opportunities, and critique-v2 evidence.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as C from '../src/contracts.js';
import { TUNING as T } from '../src/tuning.js';
import { registerCoreSim } from '../src/plugins/index.sim.js';
import { createSim } from '../src/sim/sim.js';
import { createTb1Script, tb1Slots, palaceCentre } from '../src/tb1-script.js';
import { canFire, canDesignate } from '../src/npc/index.js';
import { captureBlueprint, withRecoveryMounts, decodeCell } from '../src/ai/build.js';
import { geometryAim } from '../src/ai/aim.js';
import { shooterPosition, visibleTarget } from '../src/ai/view.js';
import { palaceIntegrity } from '../src/sim/rules.js';
import { pathObserver } from './critique-metrics.mjs';

export const POLICIES = ['novice','match1','turtle','fire-only','ballista-spam','rebuild-lane','recovery-mounts','ruler-hiding'];
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const mean = a => a.length ? a.reduce((s,x)=>s+x,0)/a.length : null;
const cellEq = (a,b) => a.every((v,i)=>v===b[i]);
const usefulTypes = new Set([C.CMD.AIM,C.CMD.FIRE,C.CMD.REPAIR_PRIORITY,C.CMD.DESIGNATE,C.CMD.DESIGNATE_WEAPON,C.CMD.ORDER_CREW,C.CMD.AMMO_PRIORITY,C.CMD.SHELTER,C.CMD.MOVE]);

/** The novice uses a rounded visual bearing and charge 100, then bounded impact corrections.
 * Expert variants get only an initial windless geometry estimate (not AI targeting/learning).
 * All changes enter through ordinary commands; neither state nor tuning is modified.
 */
export function createPolicy(initial, policy = 'novice', { initialCharge = 100 } = {}) {
  const walk = createTb1Script(), target = palaceCentre(initial.castles[1]);
  const basic = ['novice','match1'].includes(policy), firstId = initial.weapons.filter(w=>w.slot===0)[1].id;
  const original = captureBlueprint(initial.castles[0]);
  const recovery = withRecoveryMounts(initial.castles[0],original,1,initial);
  const aims = new Map(), selected = new Set([firstId]);
  let arrived = false, replacements = 0, hidden = false, returnWp = 0, returnTicks = 0, pendingOrder = null;
  const returnRoute = [[39.5,28],[37.5,28],[37.5,35.4],[36,35.4],[36,27.5],[23.5,27.5],[23.5,23.5],[20.5,23.5]];
  function options(state) {
    const c = state.castles[0], p = c.plot, live = state.weapons.filter(w=>w.slot===0&&w.hp>0);
    const damaged = original.cells.filter(b => p.type[b.index] && p.hp[b.index] < C.getBlock(p.type[b.index]).hp
      && p.hp[b.index] !== 255 && !(c.jobs??[]).some(j=>j.kind===C.JOB.REPAIR&&j.priority>0&&j.target.cell&&cellEq(j.target.cell,b.cell)));
    damaged.sort((a,b)=>Number(b.block===C.BLOCK.PALACE)-Number(a.block===C.BLOCK.PALACE)||p.hp[a.index]-p.hp[b.index]);
    const missing = original.cells.filter(b=>b.block!==C.BLOCK.PALACE && C.getBlock(b.block).cost!==null
      && p.type[b.index]===0 && canDesignate(c,{type:C.CMD.DESIGNATE,cell:b.cell,block:b.block},state));
    const slots = [...(policy==='recovery-mounts'||policy==='ballista-spam'?recovery.recoveryMounts??[]:[]),...original.mountSpots];
    const weapon = policy==='ballista-spam'?'ballista':'cannon';
    const sites = slots.filter(s=>canDesignate(c,{type:C.CMD.DESIGNATE_WEAPON,weapon,cell:s.slice(0,3)},state));
    const eye={...state.rulers[0].pos,y:state.rulers[0].pos.y+T.ruler.eye};
    const reachable=(cell,index)=>{const pos={x:p.origin.x+cell[0]+.5,y:p.origin.y+cell[1]+.5,z:p.origin.z+cell[2]+.5};
      return Math.hypot(pos.x-eye.x,pos.y-eye.y,pos.z-eye.z)<=T.ruler.interactOrderM&&visibleTarget(state,eye,{slot:0,index,pos});};
    const localDamaged=damaged.filter(b=>reachable(b.cell,b.index)),localMissing=missing.filter(b=>reachable(b.cell)),localSites=sites.filter(s=>reachable(s.slice(0,3)));
    const targetGun = live.find(w=>selected.has(w.id));
    const underFire = (c.enemyImpacts??[]).some(e=>state.tick-e.tick<10*T.sim.tickHz);
    const types = new Set();
    if (targetGun && c.gold>=C.getWeapon(targetGun.defId).fireCost) types.add(C.CMD.AIM);
    if (live.some(w=>selected.has(w.id)&&canFire(w,c)&&w.reload>=C.getWeapon(w.defId).reloadS&&c.gold>=C.getWeapon(w.defId).fireCost)) types.add(C.CMD.FIRE);
    if (damaged.length && c.gold>=7 && state.npcs.some(n=>(n.slot??n.castle)===0&&n.hp>0&&n.role===C.ROLE.MASON)) types.add(C.CMD.REPAIR_PRIORITY);
    if (missing.length) types.add(C.CMD.DESIGNATE);
    if (sites.length && live.length<original.weapons.length) types.add(C.CMD.DESIGNATE_WEAPON);
    if (live.some(w=>!w.crewOrdered)) types.add(C.CMD.ORDER_CREW);
    if (live.some(w=>w.ammo===0&&!w.ammoPriority)) types.add(C.CMD.AMMO_PRIORITY);
    if (underFire&&!c.shelter && c.population<c.initialPopulation) types.add(C.CMD.SHELTER);
    if (underFire && state.rulers[0].manning!==null) types.add(C.CMD.MOVE);
    // Separate actual first-match surface: R/G/Q/X unavailable; E's automatic crew is not a separate decision.
    const match1 = [...types].filter(t=>[C.CMD.AIM,C.CMD.FIRE,C.CMD.DESIGNATE,C.CMD.MOVE].includes(t));
    const localTypes=[...types].filter(t=>![C.CMD.ORDER_CREW,C.CMD.AMMO_PRIORITY,C.CMD.SHELTER].includes(t)
      &&(t!==C.CMD.REPAIR_PRIORITY||localDamaged.length)&&(t!==C.CMD.DESIGNATE||localMissing.length)&&(t!==C.CMD.DESIGNATE_WEAPON||localSites.length));
    return { c,live,damaged,missing,sites,weapon,types:[...types],match1,localTypes,localDamaged,localSites };
  }
  function aimFor(w,state) {
    if (w.defId==='ballista') {
      const crew=state.npcs.filter(n=>(n.slot??n.castle)===1&&n.hp>0&&n.role===C.ROLE.CREW);
      crew.sort((a,b)=>Math.hypot(a.pos.x-w.pos.x,a.pos.z-w.pos.z)-Math.hypot(b.pos.x-w.pos.x,b.pos.z-w.pos.z)||a.id-b.id);
      const victim=crew.find(n=>visibleTarget(state,shooterPosition(w,n.pos),{slot:1,pos:{...n.pos,y:n.pos.y+.9}}))??crew[0];
      if(victim){const to={...victim.pos,y:victim.pos.y+.9},from=shooterPosition(w,to);from.y=w.pos.y+.5;
        const a=geometryAim(from,to,C.getWeapon(w.defId),{x:0,z:0});return {az:(Math.round(a.azDeg*10)+3600)%3600,range:clamp(Math.round(a.dial*10),10,2550)};}
    }
    if (!aims.has(w.id)) {
      const from=shooterPosition(w,target); from.y=w.pos.y+.5;
      const solved=basic?null:geometryAim(from,target,C.getWeapon(w.defId),{x:0,z:0});
      aims.set(w.id,{ az:basic?Math.round(Math.atan2(target.x-w.pos.x,-(target.z-w.pos.z))*180/Math.PI)*10:Math.round(solved.azDeg*10), range:basic?Math.round(initialCharge*10):Math.round(solved.dial*10), observations:0 });
    }
    return aims.get(w.id);
  }
  return { options, selected, get replacements(){return replacements;},get hidingReached(){return hidden&&returnWp===returnRoute.length;},
    observe(state,events) {
      const ep=state.castles[1].plot;
      for (const e of events) if(e.type===C.EV.IMPACT&&e.payload.slot===0&&aims.has(e.payload.weaponId)) {
        const a=aims.get(e.payload.weaponId), w=state.weapons.find(w=>w.id===e.payload.weaponId), q=e.payload.pos;
        const pos=Array.isArray(q)?{x:q[0],y:q[1],z:q[2]}:q;
        if (!w || !pos || pos.x < state.castles[0].plot.origin.x+48) continue; // do not learn from own obstructions
        a.observations++;
        // A shell striking the near wall is a hit to repeat, not an undershoot to correct through the keep.
        const hitEnemy = pos.x>=ep.origin.x&&pos.x<=ep.origin.x+ep.width&&pos.z>=ep.origin.z&&pos.z<=ep.origin.z+ep.depth;
        const lateral=target.z-pos.z;
        if (Math.abs(lateral)>2) a.az+=clamp(Math.round(lateral/Math.max(1,target.x-w.pos.x)*180/Math.PI*10*.5),-10,10);
        if (!hitEnemy) a.range+=pos.x<ep.origin.x?20:-20;
        a.az=(a.az+3600)%3600; a.range=clamp(a.range,10,2550);
      }
    },
    next(state, opt) {
      const out=[], emit=(type,fields={})=>out.push({type,slot:0,tick:state.tick,seq:out.length,...fields});
      if (!arrived) {
        if (state.rulers[0].manning===firstId) { arrived=true; emit(C.CMD.ORDER_CREW,{weaponId:firstId,on:1}); }
        else return walk.next(state);
      }
      const r=state.rulers[0], c=state.castles[0], live=state.weapons.filter(w=>w.slot===0&&w.hp>0);
      if(policy==='novice'&&pendingOrder){
        const a=pendingOrder,elapsed=state.tick-a.tick;
        if(elapsed===15){const eye={...r.pos,y:r.pos.y+T.ruler.eye},o=c.plot.origin,to={x:o.x+a.command.cell[0]+.5,y:o.y+a.command.cell[1]+.5,z:o.z+a.command.cell[2]+.5};
          const dx=to.x-eye.x,dy=to.y-eye.y,dz=to.z-eye.z;
          emit(C.CMD.MOVE,{fwd:0,strafe:0,yaw:(Math.round(Math.atan2(dx,-dz)/(2*Math.PI)*65536)+65536)%65536,pitch:Math.round(Math.atan2(dy,Math.hypot(dx,dz))/(Math.PI/2)*C.K.PITCH_LIMIT),jump:0,sprint:0});}
        if(elapsed===30){
          if(a.command.type===C.CMD.DESIGNATE_WEAPON){if(canDesignate(c,a.command,state)){emit(a.command.type,a.command);replacements++;}}
          else{const i=a.command.cell[0]+c.plot.width*a.command.cell[2]+c.plot.width*c.plot.depth*a.command.cell[1],def=C.getBlock(c.plot.type[i]);if(def&&c.plot.hp[i]<def.hp)emit(a.command.type,a.command);}
        }
        if(elapsed>=45){if(live.some(w=>w.id===a.weaponId))emit(C.CMD.MAN_WEAPON,{weaponId:a.weaponId});pendingOrder=null;}
        return out;
      }
      const hiding=policy==='ruler-hiding'&&c.stats.shots>=4;
      if (hiding && !hidden) {
        if(r.manning!==null)emit(C.CMD.LEAVE_WEAPON);
        const [x,z]=returnRoute[returnWp],dx=c.plot.origin.x+x-r.pos.x,dz=c.plot.origin.z+z-r.pos.z;
        if(Math.hypot(dx,dz)<.4){returnWp++;returnTicks=0;if(returnWp===returnRoute.length){hidden=true;emit(C.CMD.MOVE,{fwd:0,strafe:0,yaw:r.yaw,pitch:0,sprint:0,jump:0});}}
        else if(++returnTicks<1800) emit(C.CMD.MOVE,{fwd:127,strafe:0,yaw:(Math.round(Math.atan2(dx,-dz)/(2*Math.PI)*65536)+65536)%65536,pitch:0,sprint:0,jump:0});
        else {hidden=true;emit(C.CMD.MOVE,{fwd:0,strafe:0,yaw:r.yaw,pitch:0,sprint:0,jump:0});}
      }
      if (state.tick % 30 === 0) {
        for(const w of live) if(selected.has(w.id)) {
          if(policy==='novice'&&r.manning!==w.id)continue;
          const a=aimFor(w,state);
          if(!hiding)emit(C.CMD.AIM,{weaponId:w.id,az:a.az,range:a.range});
          if(hiding&&!w.autoFire)emit(C.CMD.AUTO_FIRE,{weaponId:w.id,on:1});
          if(!hiding&&w.reload>=C.getWeapon(w.defId).reloadS&&canFire(w,c)&&c.gold>=C.getWeapon(w.defId).fireCost)emit(C.CMD.FIRE,{weaponId:w.id});
        }
      }
      if(!opt||state.tick%90) return out;
      if(policy==='novice'){
        for(const w of live)if(!initial.weapons.some(i=>i.id===w.id)&&!selected.has(w.id)&&Math.hypot(w.pos.x-r.pos.x,w.pos.y-r.pos.y,w.pos.z-r.pos.z)<=T.ruler.interactWeaponM){selected.add(w.id);emit(C.CMD.MAN_WEAPON,{weaponId:w.id});emit(C.CMD.ORDER_CREW,{weaponId:w.id,on:1});return out;}
        const order=opt.localDamaged[0]?{type:C.CMD.REPAIR_PRIORITY,cell:opt.localDamaged[0].cell}:null;
        const site=replacements<1&&live.length<2?opt.localSites[0]:null;
        const command=site?{type:C.CMD.DESIGNATE_WEAPON,weapon:'cannon',cell:site.slice(0,3),facing:site[3]}:order;
        // One short look/order/return sequence fits inside the current reload. No remote repairs from weapon mode.
        if(command&&(!live.find(w=>w.id===r.manning)||live.find(w=>w.id===r.manning).reload<C.getWeapon('cannon').reloadS-3)){
          pendingOrder={tick:state.tick,weaponId:r.manning,command};if(r.manning!==null)emit(C.CMD.LEAVE_WEAPON);
        }
        return out;
      }
      if (!['match1','fire-only','ruler-hiding'].includes(policy)) {
        const limit=policy==='turtle'?4:1;
        for(const b of opt.damaged.slice(0,limit))emit(C.CMD.REPAIR_PRIORITY,{cell:b.cell});
      }
      if (['turtle','rebuild-lane'].includes(policy)) {
        for(const b of opt.missing.filter(b=>policy!=='rebuild-lane'||b.cell[0]>=27&&b.cell[2]>=17&&b.cell[2]<=30).slice(0,4))emit(C.CMD.DESIGNATE,{cell:b.cell,block:b.block,facing:b.facing});
      }
      if (['ballista-spam','recovery-mounts'].includes(policy)) {
        for(const b of recovery.cells.filter(b=>b.recoveryMount&&canDesignate(c,{type:C.CMD.DESIGNATE,cell:b.cell,block:b.block},state)).slice(0,2))emit(C.CMD.DESIGNATE,{cell:b.cell,block:b.block,facing:0});
      }
      const allowed=policy==='novice'?replacements<1&&live.length<2:!['match1','fire-only','ruler-hiding'].includes(policy)&&(policy==='ballista-spam'?live.length<4:policy==='recovery-mounts'?live.length<3:live.length<2);
      if(allowed&&opt.sites.length) { const s=opt.sites[0];emit(C.CMD.DESIGNATE_WEAPON,{weapon:opt.weapon,cell:s.slice(0,3),facing:s[3]});replacements++; }
      for(const w of live) if(!initial.weapons.some(i=>i.id===w.id)&&!selected.has(w.id)) {
        selected.add(w.id);emit(C.CMD.ORDER_CREW,{weaponId:w.id,on:1});
      }
      return out;
    }
  };
}

export function runNovice({seed=1,level=5,policy='novice',maxMinutes=20,trace=false,initialCharge=100,onCommands=null}) {
  C.resetRegistriesForTests();registerCoreSim();C.freezeRegistries();
  let api;const sim=createSim({map:'forest-duel',seed,slots:tb1Slots(level),hooks:{onReady(a){api=a;}}});
  const p=createPolicy(sim.state,policy,{initialCharge}), paths=pathObserver(), windows=[], commandCounts={}, shots=[], purchases=[], commandTrace=[];
  let firstHitS=null,firstPalaceS=null, current=null, options=null, remoteManualShots=0;
  const initialWeapons=new Set(api.state.weapons.map(w=>w.id));
  const close=(state)=>{if(current){current.endS=state.tick/30;current.types=[...current.types].sort();current.localTypes=[...current.localTypes].sort();current.match1=[...current.match1].sort();current.executed=[...current.executed].sort();windows.push(current);current=null;}};
  for(let t=0;t<maxMinutes*60*30&&!api.state.outcome;t++) {
    const state=api.state;
    if(t%30===0){options=p.options(state);if(current){options.types.forEach(x=>current.types.add(x));options.match1.forEach(x=>current.match1.add(x));options.localTypes.forEach(x=>current.localTypes.add(x));}}
    const cmds=p.next(state,t%30===0?options:null);
    onCommands?.(state,cmds);
    if(seed===1||trace)commandTrace.push(...cmds);
    for(const cmd of cmds){commandCounts[cmd.type]=(commandCounts[cmd.type]??0)+1;if(current&&usefulTypes.has(cmd.type)&&![C.CMD.AIM,C.CMD.FIRE].includes(cmd.type)&&(cmd.type!==C.CMD.MOVE||cmd.fwd||cmd.strafe))current.executed.add(cmd.type);}
    sim.tick(cmds);const events=sim.drainEvents();p.observe(api.state,events);paths.sample(api.state,events);
    const enemyPlot=api.state.castles[1].plot;
    if(events.some(e=>e.type===C.EV.IMPACT&&e.payload.slot===0&&['block','weapon','person'].includes(e.payload.hit)
      &&e.payload.pos[0]>=enemyPlot.origin.x&&e.payload.pos[0]<=enemyPlot.origin.x+enemyPlot.width
      &&e.payload.pos[2]>=enemyPlot.origin.z&&e.payload.pos[2]<=enemyPlot.origin.z+enemyPlot.depth))firstHitS??=api.tick/30;
    if(palaceIntegrity(api.state.castles[1])<1)firstPalaceS??=api.tick/30;
    for(const e of events){
      if(e.type===C.EV.SHOT_FIRED&&e.payload.slot===0){
        const w=api.state.weapons.find(w=>w.id===e.payload.weaponId);shots.push({second:api.tick/30,weaponId:w.id,defId:w.defId,aim:{...w.aim}});
        if(!w.autoFire&&api.state.rulers[0].manning!==w.id)remoteManualShots++;
        if(w.defId==='cannon'){close(api.state);current={startS:api.tick/30,weaponId:w.id,types:new Set(),localTypes:new Set(),match1:new Set(),executed:new Set()};}
      }
      if(e.type===C.EV.DESIGNATION_ADDED&&e.payload.slot===0&&e.payload.weapon)purchases.push({second:api.tick/30,...e.payload});
    }
    if(current){const w=api.state.weapons.find(w=>w.id===current.weaponId);if(!w||w.hp<=0||w.reload>=C.getWeapon(w.defId).reloadS)close(api.state);}
  }
  close(api.state);
  const s=api.state, valid=windows.filter(w=>w.endS-w.startS>=10);
  return {seed,level,policy,initialCharge,seconds:s.tick/30,outcome:s.outcome,winner:s.outcome?.winners[0]??null,reason:s.castles.find(c=>c.eliminated)?.reason??'timeout',hash:sim.hash(),firstHitS,firstPalaceS,
    shots:s.castles.map(c=>c.stats.shots),palaces:s.castles.map(palaceIntegrity),gold:s.castles.map(c=>c.gold),paths:{sides:paths.sides,series:paths.series},commandCounts,purchases,remoteManualShots,hidingReached:p.hidingReached,
    newGuns:s.weapons.filter(w=>w.slot===0&&!initialWeapons.has(w.id)).map(w=>({id:w.id,type:w.defId,hp:w.hp,crew:w.crewPresent,pos:w.pos})),
    windows,shotEvents:shots,commandTrace,decisionSummary:{reloads:valid.length,meanTypes:mean(valid.map(w=>w.types.length)),meanNonAim:mean(valid.map(w=>w.types.filter(t=>![C.CMD.AIM,C.CMD.FIRE].includes(t)).length)),
      meanMatch1Types:mean(valid.map(w=>w.match1.length)),meanExecutedNonAim:mean(valid.map(w=>w.executed.length)),withTwoNonAim:valid.filter(w=>w.types.filter(t=>![C.CMD.AIM,C.CMD.FIRE].includes(t)).length>=2).length}};
}

async function main(){
  const args=process.argv.slice(2),get=(k,d)=>args.includes(k)?args[args.indexOf(k)+1]:d;
  const seeds=Number(get('--seeds','10')),workers=Number(get('--workers','6')),policyNames=get('--policies',POLICIES.join(',')).split(','),levelNames=get('--levels','2,5,8').split(',').map(Number),label=get('--label','novice');
  if(policyNames.some(p=>!POLICIES.includes(p)))throw Error('Unknown policy');
  const dir='tests/evidence/critique-v2';mkdirSync(dir,{recursive:true});
  const results=args.includes('--resume')?JSON.parse(readFileSync(`${dir}/${label}-partial.json`,'utf8')):[];
  const jobs=policyNames.flatMap(policy=>(policy==='novice'?levelNames:policy==='match1'?[2]:[5]).flatMap(level=>Array.from({length:seeds},(_,i)=>({seed:i+1,level,policy,initialCharge:Number(get('--charge','100')),maxMinutes:Number(get('--max-minutes','20'))})))).filter(j=>!results.some(r=>r.seed===j.seed&&r.level===j.level&&r.policy===j.policy));
  await Promise.all(Array.from({length:Math.min(workers,jobs.length)},()=>new Promise((resolve,reject)=>{
    const w=new Worker(new URL(import.meta.url),{workerData:true});w.on('error',reject);w.on('message',r=>{
      if(r!=='ready'){results.push(r);writeFileSync(`${dir}/${label}-partial.json`,JSON.stringify(results));console.log(`${r.policy} L${r.level} seed${r.seed}: ${r.seconds.toFixed(1)}s ${r.reason} winner${r.winner}, first hit ${r.firstHitS}, palace ${r.firstPalaceS}`);}
      const j=jobs.shift();if(j)w.postMessage(j);else{w.terminate();resolve();}
    });
  })));
  results.sort((a,b)=>a.policy.localeCompare(b.policy)||a.level-b.level||a.seed-b.seed);
  writeFileSync(`${dir}/${label}.json`,JSON.stringify({schema:1,policyDefinitions:'scripts/novice.mjs; command-only; 20 minute right-censoring',matches:results},null,2));
}
if(!isMainThread&&workerData){parentPort.on('message',j=>parentPort.postMessage(runNovice(j)));parentPort.postMessage('ready');}
else if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])await main();

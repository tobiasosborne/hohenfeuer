// owns: bounded battle observations, incoming threat, loss attribution and aiming feedback (pure UI state).
import { EV, IDLE_REASON, K, BLOCK } from '../contracts.js';
import { t } from './i18n.js';

const xyz = p => Array.isArray(p) ? p : [p?.x ?? 0,p?.y ?? 0,p?.z ?? 0];
const clamp = n => Math.max(0,Math.min(1,n));
export const battleTime = tick => `${Math.floor(tick / K.TICK_HZ / 60)}:${String(Math.floor(tick / K.TICK_HZ) % 60).padStart(2,'0')}`;
export const battlePercent = value => String(Math.round(value*1000)/10);
/** In-world labels never cover palace/pressure, the action prompt, or each other. */
export function readableWork(work) {
  const out=[];
  for(const job of work) {
    const [x,y]=job.screen??[];
    if(!Number.isFinite(x)||y<200||y>400||out.some(j=>Math.abs(j.screen[0]-x)<130&&Math.abs(j.screen[1]-y)<34))continue;
    out.push(job);if(out.length===2)break;
  }
  return out;
}
export function bearingOf(from,to) { const a=xyz(from),b=xyz(to);return (Math.atan2(b[0]-a[0],a[2]-b[2])*180/Math.PI+360)%360; }
export function cardinal(bearing,lang) { return t(['dirN','dirE','dirS','dirW'][Math.round(bearing/90)%4],lang); }

/** Arrow is clamped to the playable viewport, leaving the compass and console clear. */
export function threatEdge(bearing,heading) {
  const a=(bearing-heading)*Math.PI/180, dx=Math.sin(a),dy=-Math.cos(a);
  const k=Math.min(480/Math.max(.0001,Math.abs(dx)),164/Math.max(.0001,Math.abs(dy)));
  return {x:Math.round(512+dx*k),y:Math.round(328+dy*k),angle:a};
}

export function palaceStatus(c,tick) {
  if (!Number.isFinite(c?.palaceIntegrity)||!Number.isFinite(c?.palaceDefeatThreshold)) return null;
  if (c.palaceIntegrity>=1&&!c.keepCracking&&tick<599*K.TICK_HZ) return null;
  const integrity=clamp(c.palaceIntegrity),threshold=clamp(c.palaceDefeatThreshold);
  return {integrity,threshold,margin:Math.round((integrity-threshold)*10000)/10000};
}

const PRESSURE = {deaths:'pressureLosses','under-fire':'pressureDamage','no-gun':'pressureGuns',shelter:'pressureRecovery',casualties:'pressureLosses',losses:'pressureLosses',damage:'pressureDamage',bombardment:'pressureDamage',incoming:'pressureDamage',
  'palace-damage':'pressurePalace',palace:'pressurePalace','low-palace':'pressurePalace',fire:'pressureFire',isolation:'pressureStrain',
  'no-weapons':'pressureGuns','weapon-loss':'pressureGuns',population:'pressurePopulation',rally:'pressureRally',defiance:'pressureRally',recovery:'pressureRecovery',quiet:'pressureRecovery'};
export function dominantPressure(c,lang) {
  const causes=[...(c?.pressure??[])].filter(p=>Number.isFinite(p.weight));
  const negative=causes.filter(p=>p.weight<0);
  const p=(negative.length?negative:causes).sort((a,b)=>Math.abs(b.weight)-Math.abs(a.weight))[0];
  return t(PRESSURE[p?.cause]??'pressureStrain',lang);
}
export function pressureText(c,lang) {
  if (!c?.surrender||!Array.isArray(c.pressure)) return null;
  const s=c.surrender;
  if (s.population<s.popThreshold) return t('surrenderPopulation',lang,{cause:dominantPressure(c,lang),pop:s.population,line:s.popThreshold});
  if (s.holdTicks>0 || s.morale<=s.moraleThreshold) return t('surrenderHold',lang,{cause:dominantPressure(c,lang),s:Math.floor(s.holdTicks/K.TICK_HZ),total:Math.ceil(s.holdRequiredTicks/K.TICK_HZ)});
  const relevant=c.pressure.some(p=>p.cause!=='quiet'&&p.cause!=='recovery')||s.morale<60;
  return c.pressure.length&&relevant ? t('pressureSafe',lang,{cause:dominantPressure(c,lang),line:Math.round(s.moraleThreshold)}) : null;
}

/** One diagnosis plus one available next step; never invent an unavailable key. */
export function idleDiagnosis(w,{lang='de',distance=0,features={},manned=false}={}) {
  if (!w?.idleReason || w.idleReason===IDLE_REASON.READY) return null;
  const d=w.idleDetail??w.detail??{}, near=distance<=3, order=distance<=24;
  let key,action='idleWait';
  switch(w.idleReason) {
    case IDLE_REASON.NO_CREW: key='idleCrew';action=w.crewOrdered?'idleCrewComing':!manned&&near?'idleMan':features.orders&&order?'idleOrder':'idleApproach';break;
    case IDLE_REASON.NO_AMMO: key='idleAmmo';action=d.haulerEnRoute?'idleHauler':features.repair&&order&&!manned&&!w.ammoPriority?'idleAmmoOrder':'idleSupply';break;
    case IDLE_REASON.NO_GOLD:key='idleGold';action='idleIncome';break;
    case IDLE_REASON.OBSTRUCTED:key='idleBlocked';action=manned?'idleTurn':'idleInspect';break;
    case IDLE_REASON.DAMAGED:key='idleDamaged';action='idleOtherGun';break;
    case IDLE_REASON.RELOADING:key='reloading';break;
    default:return null;
  }
  const present=d.present??d.crewPresent,required=d.required??d.crewRequired;
  const crew=key==='idleCrew'&&Number.isFinite(present)&&Number.isFinite(required)?` ${present}/${required}`:'';
  return `${t(key,lang)}${crew} / ${t(action,lang)}`;
}

export function impactOffset(origin,aimPoint,impact) {
  const o=xyz(origin),a=xyz(aimPoint),p=xyz(impact),dx=a[0]-o[0],dz=a[2]-o[2],len=Math.hypot(dx,dz)||1;
  return {range:Math.round(((p[0]-a[0])*dx+(p[2]-a[2])*dz)/len),lateral:Math.round(((p[0]-a[0])*-dz+(p[2]-a[2])*dx)/len)};
}
export function impactText(impact,lang) {
  const {range,lateral}=impact.offset;
  const along=t(Math.abs(range)<1?'impactRangeOn':range<0?'impactShort':'impactLong',lang,{m:Math.abs(range)});
  const across=t(Math.abs(lateral)<1?'impactLineOn':lateral<0?'impactLeft':'impactRight',lang,{m:Math.abs(lateral)});
  return `${t({palace:'impactPalace',wall:'impactWall',weapon:'impactGun',person:'impactPerson',ground:'impactGround'}[impact.kind]??'impactGround',lang)} / ${along} / ${across}`;
}

/** Stores IDs and launch snapshots, never sim references. */
export function createBattleFeedback(slot) {
  const threats=new Map(), seen=new Set(), shots=new Map(), marks=new Map(), impacts=new Map(), account=[];
  let death=null, eliminated=null, rose=false, reached=false, lastSoundTick=-Infinity;
  function remember(item) {
    // One blast can damage dozens of voxels. A compact account keeps causes, not voxel noise.
    const last=account.at(-1);
    if(last?.kind===item.kind&&item.tick-last.tick<K.TICK_HZ&&last.fromCastle===item.fromCastle) account[account.length-1]={...item,count:(last.count??1)+(item.count??1)};
    else account.push(item);
    if(account.length>12) account.shift();
  }
  function source(p,state) {
    const gun=state.weapons?.find(w=>w.id===p.fromWeapon), castle=state.castles?.[p.fromCastle];
    const pos=gun?.pos??castle?.plot?.origin;
    return {fromCastle:p.fromCastle,fromWeapon:p.fromWeapon,defId:gun?.defId,bearing:pos?bearingOf(state.rulers?.[slot]?.pos,pos):null};
  }
  const api={
    shot(ref,tick) {
      const key=ref.projectileId??`w:${ref.weaponId}`;
      const prev=marks.get(ref.weaponId);
      const copy={...ref,origin:xyz(ref.origin),aimPoint:xyz(ref.aimPoint),aim:{...ref.aim},tick,previousImpact:prev?.impact??prev?.previousImpact??null};
      shots.set(key,copy);marks.set(ref.weaponId,copy);
      if(shots.size>64)shots.delete(shots.keys().next().value);
    },
    ingest(events,state) {
      const tick=state.tick,warnings=[],notices=[];
      for(const e of events) {
        const p=e.payload??{};
        if(e.type===EV.RULER_THREAT&&p.castle===slot&&p.etaTicks>0&&!seen.has(p.projectileId)) {
          seen.add(p.projectileId);if(seen.size>256)seen.delete(seen.values().next().value);
          const item={...p,...source(p,state),tick,until:tick+p.etaTicks};
          threats.set(p.projectileId,item);warnings.push(item);remember({...item,kind:'incoming'});
        }
        if(e.type===EV.IMPACT) {
          if(p.projectileId!==undefined)threats.delete(p.projectileId);
          else for(const [id,tr]of threats) if(tr.fromWeapon===p.weaponId)threats.delete(id);
          if(p.slot===slot&&p.pos) {
            const ref=shots.get(p.projectileId)??shots.get(`w:${p.weaponId}`)??marks.get(p.weaponId);
            if(ref) {
              // Attribute palace damage only to this impact's adjacent damage batch, before the next impact.
              const start=events.indexOf(e),end=events.findIndex((other,i)=>i>start&&other.type===EV.IMPACT);
              const damage=events.slice(start+1,end<0?events.length:end);
              const palace=damage.some(d=>[EV.BLOCK_DAMAGED,EV.BLOCK_DESTROYED].includes(d.type)&&d.payload.plot!==slot&&d.payload.id===BLOCK.PALACE);
              const result={...ref,impact:xyz(p.pos),offset:impactOffset(ref.origin,ref.aimPoint,p.pos),kind:palace?'palace':p.hit==='block'?'wall':['weapon','person'].includes(p.hit)?p.hit:'ground',until:tick+2*K.TICK_HZ};
              const latest=marks.get(p.weaponId);
              if(!latest||ref.tick>=latest.tick)marks.set(p.weaponId,result);
              else marks.set(p.weaponId,{...latest,previousImpact:result.impact});
              impacts.set(p.weaponId,result);
            }
          }
        }
        if(e.type===EV.WEAPON_DESTROYED&&p.slot===slot)remember({kind:'gunLost',tick});
        if([EV.NPC_DIED,EV.NPC_DESERTED].includes(e.type)&&p.castle===slot)remember({kind:'losses',tick,count:1});
        if(e.type===EV.MAGAZINE_EXPLODED&&p.plot===slot)remember({kind:'magazine',tick});
        if(e.type===EV.BLOCK_DESTROYED&&p.plot===slot&&p.id===BLOCK.PALACE)remember({kind:'palace',tick});
        if(e.type===EV.RULER_DIED&&p.slot===slot) {
          death={...p,...source(p,state),tick};remember({...death,kind:'ruler'});
        }
        if(e.type===EV.CASTLE_ELIMINATED&&p.slot===slot) {
          eliminated={...state.castles[slot],tick,reason:p.reason};
          if(p.reason!=='ruler')remember({kind:p.reason,tick});
        }
      }
      for(const [id,tr]of threats)if(tr.until<=tick)threats.delete(id);
      const c=state.castles?.[slot];
      if(Number.isFinite(c?.palaceDefeatThreshold)) {
        if(!rose&&tick>=600*K.TICK_HZ){rose=true;notices.push('palaceRising');}
        if(!reached&&c.palaceDefeatThreshold>=.55){reached=true;notices.push('palaceReached');}
      }
      const sound=warnings.length>0&&tick-lastSoundTick>=K.TICK_HZ;
      if(sound)lastSoundTick=tick;
      return {warnings,notices,sound};
    },
    danger(tick){const tr=[...threats.values()].filter(tr=>tr.until>tick).sort((a,b)=>a.until-b.until)[0];return tr?{...tr,etaTicks:tr.until-tick}:null;},
    impact(id,tick){const r=impacts.get(id);return r&&tick<r.until?r:null;},
    reference(id){return marks.get(id)??null;},
    get death(){return death;},get elimination(){return eliminated;},get events(){return account.slice(-3);},
  };return api;
}

/** No guessed killer: legacy events still produce an honest cause-specific sentence. */
export function lossAccount(state,slot,feedback,{lang='de',nameOf,weaponName}={}) {
  const c=feedback?.elimination??state.castles?.[slot]??{},d=feedback?.death;
  const time=battleTime(c.tick??c.stats?.eliminatedTick??d?.tick??state.outcome?.tick??state.tick);
  let cause;
  if(c.reason==='ruler'||!c.reason&&d) {
    cause=d&&Number.isInteger(d.fromCastle)&&Number.isInteger(d.fromWeapon)?t('lossRulerShot',lang,{time,name:nameOf?.(d.fromCastle)??t('castleNumber',lang,{n:d.fromCastle+1}),weapon:weaponName?.(d.fromWeapon,d.defId)??t('enemyWeapon',lang),dir:Number.isFinite(d.bearing)?cardinal(d.bearing,lang):t('unknownBearing',lang)})
      :t('lossRuler',lang,{time,cause:t({fall:'deathFall',fire:'deathFire',blast:'deathBlast',collapse:'deathCollapse',projectile:'deathProjectile'}[d?.cause]??'deathDamage',lang)});
  } else if(c.reason==='palace') cause=Number.isFinite(c.palaceIntegrity)&&Number.isFinite(c.palaceDefeatThreshold)?t('lossPalace',lang,{time,pct:battlePercent(c.palaceIntegrity),line:battlePercent(c.palaceDefeatThreshold)}):t('lossPalaceFallback',lang,{time});
  else if(c.reason==='surrender') {
    const population=c.surrender&&c.surrender.population<c.surrender.popThreshold;
    const harmful=(c.pressure??[]).filter(p=>!['quiet','recovery','rally','defiance','shelter'].includes(p.cause));
    cause=population||harmful.length?t('lossSurrender',lang,{time,cause:population?t('pressurePopulation',lang):dominantPressure({...c,pressure:harmful},lang)}):t('lossSurrenderFallback',lang,{time});
  }
  else cause=t('lossFallback',lang,{time});
  const events=(feedback?.events??[]).map(e=>t('accountEvent',lang,{time:battleTime(e.tick),event:t({incoming:'accountIncoming',gunLost:'accountGun',losses:'accountLosses',magazine:'accountMagazine',palace:'accountPalace',ruler:'accountRuler',surrender:'accountSurrender'}[e.kind]??'accountDamage',lang,{n:e.count??1})}));
  return {cause,events};
}

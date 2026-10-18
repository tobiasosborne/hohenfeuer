// owns: consequence-ranked, locally reachable reload choices independent of camera visibility.
import { BLOCK, CMD, JOB, getBlock, getWeapon } from '../contracts.js';
import { TUNING as T } from '../tuning.js';
import { canDesignate } from '../npc/index.js';
import { pick, ghost } from './interact.js';
import { t } from '../ui/i18n.js';

const eq=(a,b)=>a?.length===b?.length&&a.every((n,i)=>n===b[i]);
const index=(p,c)=>c[0]+p.width*c[2]+p.width*p.depth*c[1];
const world=(p,c)=>[p.origin.x+c[0]+.5,p.origin.y+c[1]+.5,p.origin.z+c[2]+.5];

export function interventionText(a,lang,manned=false,view) {
  const text=t({repair:'optionRepair',build:'optionBuild',replacement:'optionReplacement',crew:'optionCrew',man:'optionMan',cover:manned?'optionCover':'optionCoverWalk'}[a.kind],lang,{cost:Math.ceil(a.cost*10)/10});
  if(!a.pos||!view)return text;
  const o=view.origin,dx=a.pos[0]-o.x,dz=a.pos[2]-o.z,bearing=Math.atan2(dx,-dz)*180/Math.PI;
  const turn=((bearing-view.heading+540)%360)-180;
  const dir=t(Math.abs(turn)>135?'optionBehind':Math.abs(turn)<30?'optionAhead':turn<0?'optionLeft':'optionRight',lang);
  return `${text} / ${t('optionDirection',lang,{dir,m:Math.round(Math.hypot(dx,dz))})}`;
}

/** A cheap 12-second consequence estimate; no simulation forks or hidden enemy plans in the HUD. */
function consequence(a,state,c,masons) {
  if(a.kind==='cover')return 1e6;
  if(['crew','man'].includes(a.kind))return 200;
  const p=c.plot,def=getBlock(a.block??p.type[index(p,a.cell)]),missing=a.missing??def?.hp??0;
  const travel=Math.min(...masons.map(n=>Math.hypot(n.pos?.x-a.pos[0],n.pos?.z-a.pos[2])/2+Math.abs((n.pos?.y??0)-a.pos[1])/2).filter(Number.isFinite),12);
  const work=Math.max(.1,12-travel)/12;
  const palace=(a.block??p.type[index(p,a.cell)])===BLOCK.PALACE;
  const gun=state.weapons.some(w=>w.slot===c.slot&&w.hp>0&&Math.hypot(w.pos.x-a.pos[0],w.pos.z-a.pos[2])<3&&a.pos[1]<=w.pos.y+.5);
  if(a.kind==='replacement')return (state.weapons.some(w=>w.slot===c.slot&&w.hp>0)?20:400)-a.cost*.01;
  return work*missing*(palace?10000/Math.max(1,c.initialPalaceHp??576):gun ? .1 : .01)-a.cost*.01;
}

/** Only actions reachable by turning from here, never hypothetical whole-castle availability. */
export function localInterventions(state,slot,{features,blueprint=[],threatened=false,limit=2}={}) {
  const c=state.castles[slot],r=state.rulers[slot],p=c.plot,f=features;
  if(c.eliminated||r.hp<=0)return [];
  const eye=[r.pos.x,r.pos.y+T.ruler.eye,r.pos.z],out=[];
  const guns=state.weapons.filter(w=>w.hp>0).map(w=>({id:w.id,slot:w.slot,defId:w.defId,crewOrdered:w.crewOrdered,min:[w.pos.x-.5,w.pos.y,w.pos.z-.5],max:[w.pos.x+.5,w.pos.y+1,w.pos.z+.5]}));
  const at=pos=> {
    const dx=pos[0]-eye[0],dy=pos[1]-eye[1],dz=pos[2]-eye[2];
    return pick({eye,yaw:Math.atan2(dx,-dz),pitch:Math.atan2(dy,Math.hypot(dx,dz)),slot,plots:state.castles.map(c=>({plot:c.plot,slot:c.slot})),weapons:guns});
  };
  const nearby=pos=>Math.hypot(pos[0]-eye[0],pos[1]-eye[1],pos[2]-eye[2])<=T.ruler.interactOrderM;
  // Safety is a movement choice, with an explicit time/aiming cost; shelter orders never protect the ruler.
  if(threatened)out.push({kind:'cover',cost:0});
  const masons=state.npcs.filter(n=>(n.slot??n.castle)===slot&&n.hp>0&&!n.deserted&&n.role==='mason');
  const mason=masons.length>0;
  if(f.repair&&mason) {
    const cells=[];
    const y0=Math.max(1,Math.floor(r.pos.y-p.origin.y)-24),y1=Math.min(p.height-1,y0+48);
    for(let y=y0;y<=y1;y++)for(let z=Math.max(0,Math.floor(r.pos.z-p.origin.z)-24);z<Math.min(p.depth,Math.floor(r.pos.z-p.origin.z)+25);z++)for(let x=Math.max(0,Math.floor(r.pos.x-p.origin.x)-24);x<Math.min(p.width,Math.floor(r.pos.x-p.origin.x)+25);x++){
      const cell=[x,y,z],i=index(p,cell),def=getBlock(p.type[i]);
      if(!def||p.type[i]===BLOCK.AIR||p.hp[i]<=0||p.hp[i]>=def.hp||def.hp===255)continue;
      const pos=world(p,cell),job=c.jobs?.find(j=>j.kind===JOB.REPAIR&&eq(j.target.cell,cell));
      if(!nearby(pos)||job&&(job.priority>0||job.reachable===false||job.claimedBy?.length))continue;
      const cost=(def.cost??T.economy.mapOnlyRepairBlockCost)*T.economy.repairCostFrac*(1-p.hp[i]/def.hp);
      if(c.gold<cost)continue;
      cells.push({kind:'repair',cell,pos,cost,hp:p.hp[i]/def.hp,missing:def.hp-p.hp[i]});
    }
    cells.sort((a,b)=>consequence(b,state,c,masons)-consequence(a,state,c,masons)||a.hp-b.hp);
    for(const a of cells){const hit=at(a.pos);if(hit.own&&hit.kind==='block'&&eq(hit.cell,a.cell)){out.push(a);if(out.filter(a=>a.kind==='repair').length>=6)break;}}
  }
  for(const w of state.weapons) {
    if(w.slot!==slot||w.hp<=0||w.crewOrdered||!f.weapons.includes(w.defId))continue;
    const pos=[w.pos.x,w.pos.y+.5,w.pos.z],hit=at(pos);
    if(hit.kind!=='weapon'||hit.weaponId!==w.id)continue;
    const kind=f.orders?'crew':r.manning==null&&hit.dist<=T.ruler.interactWeaponM?'man':null;
    if(kind){out.push({kind,weaponId:w.id,pos,cost:0});break;}
  }
  if(mason) {
    const dead=state.weapons.find(w=>w.slot===slot&&w.hp<=0);
    const candidates=[];
    if(dead&&f.placement&&f.weapons.includes('cannon')) {
      for(const w of state.weapons.filter(w=>w.slot===slot&&w.hp<=0))candidates.push({kind:'replacement',cell:[Math.floor(w.pos.x-p.origin.x),Math.floor(w.pos.y-p.origin.y),Math.floor(w.pos.z-p.origin.z)],weapon:'cannon'});
    }
    for(const b of blueprint)if(b.block===BLOCK.STONE&&p.type[index(p,b.cell)]===BLOCK.AIR)candidates.push({kind:'build',cell:b.cell,block:BLOCK.STONE});
    // In the first match, a damaged visible wall can be reinforced with the already taught stone tool.
    // It still has to pass the same paid designation and face-picking checks below.
    if(!f.repair)for(const b of blueprint) {
      const i=index(p,b.cell);
      if(p.type[i]!==BLOCK.STONE||p.hp[i]>=getBlock(BLOCK.STONE).hp)continue;
      for(const d of [[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]])candidates.push({kind:'build',cell:b.cell.map((n,i)=>n+d[i]),block:BLOCK.STONE});
    }
    for(const a of candidates) {
      const pos=world(p,a.cell),isGun=a.kind==='replacement',def=isGun?getWeapon('cannon'):getBlock(BLOCK.STONE);
      if(!nearby(pos)||!canDesignate(c,{type:isGun?CMD.DESIGNATE_WEAPON:CMD.DESIGNATE,cell:a.cell,weapon:a.weapon,block:a.block},state))continue;
      // Find a visible adjacent face that actually produces this ghost, with the real player picker.
      let valid=false;
      for(const d of [[0,-1,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[0,1,0]]) {
        const neighbor=a.cell.map((v,i)=>v+d[i]),hit=at(world(p,neighbor));
        const g=ghost({target:hit,plot:p,slot,yaw:0,gold:c.gold,people:[...state.rulers,...state.npcs],weapons:state.weapons,
          weaponCount:state.weapons.filter(w=>w.slot===slot&&w.hp>0).length,openDesignations:c.npcDesignations?.length??0,
          build:{mode:isGun?'weapon':'block',cost:def.cost,footprint:def.footprint,mount:def.mount}});
        if(g?.valid&&eq(g.cell,a.cell)){valid=true;break;}
      }
      if(valid){out.push({...a,pos,cost:def.cost});break;}
    }
  }
  out.sort((a,b)=>consequence(b,state,c,masons)-consequence(a,state,c,masons));
  return out.filter((a,i)=>!out.slice(0,i).some(b=>a.kind===b.kind&&(a.kind!=='repair'||eq(a.cell,b.cell))))
    .slice(0,Math.min(2,limit));
}

/** At most two active jobs: health/work progress anchored on the actual block, no remote x-ray labels. */
export function localWorkProgress(state,slot) {
  const c=state.castles[slot],p=c.plot;
  return (c.jobs??[]).filter(j=>[JOB.REPAIR,JOB.BUILD].includes(j.kind)&&j.target.cell&&j.reachable!==false).map(j=>{
    const cell=j.target.cell,i=index(p,cell),def=getBlock(p.type[i]);
    return {cell,pos:world(p,cell),kind:j.kind,active:!!j.claimedBy?.length,progress:j.kind===JOB.REPAIR&&def? p.hp[i]/def.hp:j.progress??0};
  });
}

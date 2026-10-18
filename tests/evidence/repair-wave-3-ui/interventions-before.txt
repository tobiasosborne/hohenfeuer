// owns: read-only, locally reachable reload choices using the same picker and placement rules as player input.
import { BLOCK, CMD, JOB, getBlock, getWeapon } from '../contracts.js';
import { TUNING as T } from '../tuning.js';
import { canDesignate } from '../npc/index.js';
import { pick, ghost } from './interact.js';
import { t } from '../ui/i18n.js';

const eq=(a,b)=>a?.length===b?.length&&a.every((n,i)=>n===b[i]);
const index=(p,c)=>c[0]+p.width*c[2]+p.width*p.depth*c[1];
const world=(p,c)=>[p.origin.x+c[0]+.5,p.origin.y+c[1]+.5,p.origin.z+c[2]+.5];

export function interventionText(a,lang,manned=false) {
  return t({repair:'optionRepair',build:'optionBuild',replacement:'optionReplacement',crew:'optionCrew',man:'optionMan',cover:manned?'optionCover':'optionCoverWalk'}[a.kind],lang,{cost:Math.ceil(a.cost*10)/10});
}

/** Only actions reachable by turning from here, never hypothetical whole-castle availability. */
export function localInterventions(state,slot,{features,blueprint=[],threatened=false,limit=2,visible=()=>true}={}) {
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
  const mason=state.npcs.some(n=>(n.slot??n.castle)===slot&&n.hp>0&&!n.deserted&&n.role==='mason');
  if(f.repair&&mason) {
    const cells=[];
    const y0=Math.max(1,Math.floor(r.pos.y-p.origin.y)-24),y1=Math.min(p.height-1,y0+48);
    for(let y=y0;y<=y1;y++)for(let z=Math.max(0,Math.floor(r.pos.z-p.origin.z)-24);z<Math.min(p.depth,Math.floor(r.pos.z-p.origin.z)+25);z++)for(let x=Math.max(0,Math.floor(r.pos.x-p.origin.x)-24);x<Math.min(p.width,Math.floor(r.pos.x-p.origin.x)+25);x++){
      const cell=[x,y,z],i=index(p,cell),def=getBlock(p.type[i]);
      if(!def||p.type[i]===BLOCK.AIR||p.hp[i]<=0||p.hp[i]>=def.hp||def.hp===255)continue;
      const pos=world(p,cell),job=c.jobs?.find(j=>j.kind===JOB.REPAIR&&eq(j.target.cell,cell));
      if(!nearby(pos)||!visible(pos)||job&&(job.priority>0||job.reachable===false))continue;
      const cost=(def.cost??T.economy.mapOnlyRepairBlockCost)*T.economy.repairCostFrac*(1-p.hp[i]/def.hp);
      if(c.gold<cost)continue;
      cells.push({kind:'repair',cell,pos,cost,hp:p.hp[i]/def.hp});
    }
    cells.sort((a,b)=>a.hp-b.hp);
    for(const a of cells){const hit=at(a.pos);if(hit.own&&hit.kind==='block'&&eq(hit.cell,a.cell)){out.push(a);break;}}
  }
  for(const w of state.weapons) {
    if(w.slot!==slot||w.hp<=0||w.crewOrdered||!f.weapons.includes(w.defId))continue;
    const pos=[w.pos.x,w.pos.y+.5,w.pos.z],hit=at(pos);
    if(!visible(pos,'crew')||hit.kind!=='weapon'||hit.weaponId!==w.id)continue;
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
      if(p.type[i]!==BLOCK.STONE||p.hp[i]>=getBlock(BLOCK.STONE).hp||!visible(world(p,b.cell)))continue;
      for(const d of [[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]])candidates.push({kind:'build',cell:b.cell.map((n,i)=>n+d[i]),block:BLOCK.STONE});
    }
    for(const a of candidates) {
      const pos=world(p,a.cell),isGun=a.kind==='replacement',def=isGun?getWeapon('cannon'):getBlock(BLOCK.STONE);
      if(!nearby(pos)||!visible(pos)||!canDesignate(c,{type:isGun?CMD.DESIGNATE_WEAPON:CMD.DESIGNATE,cell:a.cell,weapon:a.weapon,block:a.block},state))continue;
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
  return out.slice(0,Math.min(2,limit));
}

/** At most two active jobs: health/work progress anchored on the actual block, no remote x-ray labels. */
export function localWorkProgress(state,slot) {
  const c=state.castles[slot],p=c.plot;
  return (c.jobs??[]).filter(j=>[JOB.REPAIR,JOB.BUILD].includes(j.kind)&&j.target.cell&&j.reachable!==false).map(j=>{
    const cell=j.target.cell,i=index(p,cell),def=getBlock(p.type[i]);
    return {cell,pos:world(p,cell),kind:j.kind,active:!!j.claimedBy?.length,progress:j.kind===JOB.REPAIR&&def? p.hp[i]/def.hp:j.progress??0};
  });
}

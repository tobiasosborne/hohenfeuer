// src/npc/kinematics.js - owns role-speed path following and physical arrival.
import { BLOCK, NPC_STATE, EV, K } from '../contracts.js';
import { TUNING as T } from '../tuning.js';
import { typeAt, blockDef, feet, ownNpcs, localCell } from './model.js';
import { pathValid, isStandable } from './path.js';
import { spawnPopulation } from './brain.js';
import { releaseClaim, discoverMagazines } from './jobs.js';
import { updateCrews } from './crew.js';

/** Broken floors release claims and let gravity return workers to surviving paths. */
function fall(api, castle, npc) {
  const p = castle.plot, cell = localCell(p, npc.pos);
  if (!npc.falling && isStandable(p, cell)) return false;
  if (!npc.falling && npc.path?.length && npc.state === NPC_STATE.WALK && pathValid(p,npc.path,Math.max(0,npc.pathIndex-1))) return false;
  if (!npc.falling) { releaseClaim(castle,npc); npc.falling={peak:npc.pos.y,speed:0}; }
  let landing = null;
  for (let y=Math.min(p.height-2,cell[1]);y>=T.world.buildMinY;y--) {
    if (isStandable(p,[cell[0],y,cell[2]])) { landing=feet(p,[cell[0],y,cell[2]]).y; break; }
  }
  if (landing === null) return false;
  npc.prevPos={...npc.pos}; npc.falling.speed += T.sim.gravity*K.DT;
  npc.pos.y=Math.max(landing,npc.pos.y-npc.falling.speed*K.DT); npc.state=NPC_STATE.WALK;
  if (npc.pos.y===landing) {
    const damage=Math.max(0,npc.falling.peak-landing-T.people.fallSafeM)*T.people.fallDmgPerM;
    npc.falling=null; npc.hp=Math.max(0,npc.hp-damage); npc.state=npc.hp>0?NPC_STATE.IDLE:NPC_STATE.DEAD; npc.nextPlanTick=api.tick;
    if (damage>0) api.emit(EV.PERSON_DAMAGED,{entityId:npc.id,hp:npc.hp});
    if (npc.hp<=0 && !npc.dead) { npc.dead=true;api.emit(EV.NPC_DIED,{entityId:npc.id,role:npc.role,castle:castle.id,cause:'fall'}); }
  }
  return true;
}

/** Lane entry point at tick step two; all movement happens before weapons check crews. */
export function npcKinematics(api) {
  for (const castle of api.state.castles) {
    if (castle.eliminated) continue;
    spawnPopulation(api, castle);
    discoverMagazines(api, castle);
    for (const npc of ownNpcs(api, castle)) {
      if (npc.hp <= 0 || npc.deserted) continue;
      if (fall(api,castle,npc)) continue;
      if (npc.state !== NPC_STATE.WALK && npc.state !== NPC_STATE.FLEE) continue;
      if (npc.pathNavVersion !== castle.plot.navVersion || npc.pathCheckIndex !== npc.pathIndex) {
        if (!pathValid(castle.plot, npc.path, Math.max(0, npc.pathIndex - 1))) {
          releaseClaim(castle, npc); npc.shelterCell = null; continue;
        }
        npc.pathNavVersion = castle.plot.navVersion;
        npc.pathCheckIndex = npc.pathIndex;
      }
      npc.prevPos = { ...npc.pos };
      let remaining = K.DT;
      while (remaining > 0 && npc.pathIndex < npc.path.length) {
        if (npc.pathCheckIndex !== npc.pathIndex) {
          if (!pathValid(castle.plot, npc.path, Math.max(0, npc.pathIndex - 1))) { releaseClaim(castle, npc); npc.shelterCell = null; break; }
          npc.pathCheckIndex = npc.pathIndex;
        }
        const from = npc.path[Math.max(0, npc.pathIndex - 1)], to = npc.path[npc.pathIndex];
        let target = feet(castle.plot,to), intermediate=false;
        let speed = npc.state === NPC_STATE.FLEE ? T.npc.fleeSpeed : npc.carrying > 0 ? npc.carrySpeed ?? T.npc.carrySpeed : npc.speed ?? T.npc.speed;
        const a = typeAt(castle.plot, from), b = typeAt(castle.plot, to);
        const clamber=to[1]>from[1]&&a!==BLOCK.STAIRS&&!blockDef(a)?.climbable;
        if (clamber) {
          speed*=T.npc.clamberSpeedMul;
          if(npc.pos.y<target.y-1e-9){const base=feet(castle.plot,from);
            target=Math.abs(npc.pos.x-base.x)+Math.abs(npc.pos.z-base.z)>1e-9?{x:base.x,y:npc.pos.y,z:base.z}:{x:npc.pos.x,y:target.y,z:npc.pos.z};intermediate=true;}
        }
        if (from[0] === to[0] && from[2] === to[2] && from[1] !== to[1] && (blockDef(a)?.climbable || blockDef(b)?.climbable)) speed = npc.climbSpeed ?? T.npc.ladderSpeed;
        else if (a === BLOCK.STAIRS || b === BLOCK.STAIRS) speed *= T.npc.stairsMul;
        const dx = target.x - npc.pos.x, dy = target.y - npc.pos.y, dz = target.z - npc.pos.z, distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const tolerance = T.people.npcRadius / K.TICK_HZ;
        if (distance <= speed * remaining + tolerance) {
          npc.pos = target; if(!intermediate)npc.pathIndex++; remaining = Math.max(0, remaining - distance / speed);
        } else {
          const fraction = speed * remaining / distance;
          npc.pos.x += dx * fraction; npc.pos.y += dy * fraction; npc.pos.z += dz * fraction; remaining = 0;
        }
        npc.lastProgressTick = api.tick;
      }
      if (npc.path.length && npc.pathIndex >= npc.path.length) npc.state = npc.shelterCell ? NPC_STATE.SHELTER : npc.deserting ? NPC_STATE.FLEE : NPC_STATE.WORK;
    }
    updateCrews(api, castle);
  }
}

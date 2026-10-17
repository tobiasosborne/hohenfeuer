// src/npc/kinematics.js - owns role-speed path following and physical arrival.
import { BLOCK, NPC_STATE, K } from '../contracts.js';
import { TUNING as T } from '../tuning.js';
import { typeAt, blockDef, feet, ownNpcs } from './model.js';
import { pathValid } from './path.js';
import { spawnPopulation } from './brain.js';
import { releaseClaim, discoverMagazines } from './jobs.js';
import { updateCrews } from './crew.js';

/** Lane entry point at tick step two; all movement happens before weapons check crews. */
export function npcKinematics(api) {
  for (const castle of api.state.castles) {
    if (castle.eliminated) continue;
    spawnPopulation(api, castle);
    discoverMagazines(api, castle);
    for (const npc of ownNpcs(api, castle)) {
      if (npc.hp <= 0 || npc.deserted || npc.state !== NPC_STATE.WALK && npc.state !== NPC_STATE.FLEE) continue;
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
        const from = npc.path[Math.max(0, npc.pathIndex - 1)], to = npc.path[npc.pathIndex], target = feet(castle.plot, to);
        let speed = npc.state === NPC_STATE.FLEE ? T.npc.fleeSpeed : npc.carrying > 0 ? npc.carrySpeed ?? T.npc.carrySpeed : npc.speed ?? T.npc.speed;
        const a = typeAt(castle.plot, from), b = typeAt(castle.plot, to);
        if (from[0] === to[0] && from[2] === to[2] && from[1] !== to[1] && (blockDef(a)?.climbable || blockDef(b)?.climbable)) speed = npc.climbSpeed ?? T.npc.ladderSpeed;
        else if (a === BLOCK.STAIRS || b === BLOCK.STAIRS) speed *= T.npc.stairsMul;
        const dx = target.x - npc.pos.x, dy = target.y - npc.pos.y, dz = target.z - npc.pos.z, distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const tolerance = T.people.npcRadius / K.TICK_HZ;
        if (distance <= speed * remaining + tolerance) {
          npc.pos = target; npc.pathIndex++; remaining = Math.max(0, remaining - distance / speed);
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

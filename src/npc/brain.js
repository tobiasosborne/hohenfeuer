// src/npc/brain.js - owns NPC population, roles, shelter and the per-tick state machine.
import { BLOCK, ROLE, JOB, NPC_STATE, EV, getBlockByKey, RNG_STREAM, PLUGIN_KIND, getNpcType, listPlugins, K } from '../contracts.js';
import { TUNING as T } from '../tuning.js';
import { castleDef, blockDef, cellOf, indexOf, typeAt, feet, localCell, distanceSq, manhattan, ticks, ownNpcs, ownWeapons, weaponDef, blocksWeaponMuzzle } from './model.js';
import { isStandable, neighbors } from './path.js';
import { emitJobs, expireClaims, claimJob, releaseClaim, planPath, setPath, tickWork, weaponWorkCells, workCells, outsideBuildSites } from './jobs.js';
import { personOverlapsWeaponSite, personOverlapsCell } from './designations.js';
import { queueMoraleInput } from './morale.js';
import { updateCrews } from './crew.js';

const roles = [ROLE.CREW, ROLE.RUNNER, ROLE.MASON, ROLE.CIVILIAN];
const roleJobs = { [ROLE.CREW]: [JOB.CREW, JOB.HAUL_AMMO], [ROLE.RUNNER]: [JOB.HAUL_AMMO],
  [ROLE.MASON]: [JOB.BUILD, JOB.REPAIR, JOB.DEMOLISH], [ROLE.CIVILIAN]: [JOB.WORK] };
const shelterCache = new WeakMap();

/** Explicit rooms plus covered, standable cells; topology caches are derived and disposable. */
export function shelterCells(castle) {
  const p = castle.plot, cached = shelterCache.get(p);
  if (cached?.version === p.navVersion) return cached.cells;
  const ids = new Set();
  for (const box of castle.shelters ?? []) for (let y = box[1]; y <= box[4]; y++) for (let z = box[2]; z <= box[5]; z++) for (let x = box[0]; x <= box[3]; x++) {
    const c = [x, y, z]; if (isStandable(p, c)) ids.add(indexOf(p, c));
  }
  for (let i = p.width * p.depth; i < p.type.length; i++) {
    const c = cellOf(p, i);
    if (!isStandable(p, c)) continue;
    let solid = 0;
    for (let dy = 1; dy <= T.npc.shelterAboveRange; dy++) if (blockDef(typeAt(p, [c[0], c[1] + dy, c[2]]))?.solid) solid++;
    if (solid >= T.npc.shelterSolidAbove) ids.add(i);
  }
  const cells = [...ids].sort((a, b) => a - b).map(i => cellOf(p, i));
  shelterCache.set(p, { version: p.navVersion, cells }); return cells;
}

function roleDefinition(role, ordinal = 0, count = 1) {
  const defs = listPlugins(PLUGIN_KIND.NPC_TYPE).filter(d => d.role === role);
  if (!defs.length) return null;
  const total = defs.reduce((sum, d) => sum + d.share, 0);
  let at = total * (ordinal + 0.5) / count;
  for (const def of defs) { at -= def.share; if (at <= 0) return def; }
  return defs.at(-1);
}

function setRole(npc, role, def = roleDefinition(role)) {
  npc.role = role; npc.typeId = def?.id ?? null; npc.jobs = [...(def?.jobs ?? roleJobs[role])];
  npc.speed = def?.speed ?? T.npc.speed; npc.carrySpeed = def?.carrySpeed ?? T.npc.carrySpeed;
  npc.climbSpeed = def?.climbSpeed ?? T.npc.ladderSpeed; npc.workMul = def?.workMul ?? 1;
  const flee = def?.flee ?? (role === ROLE.CIVILIAN ? T.npc.fleeCivilian : T.npc.fleeCrew);
  npc.fleeThreshold = flee.base + (npc.bravery ?? 0) * flee.spread;
}

/** Spawn once, including before weapons on tick zero when called through npcKinematics. */
export function spawnPopulation(api, castle) {
  if (castle.npcSpawned) return;
  castle.npcSpawned = true;
  const existing = ownNpcs(api, castle);
  if (existing.length) { castle.initialPopulation ||= existing.length; castle.population = existing.filter(n => n.hp > 0).length; return; }
  const p = castle.plot, def = castleDef(castle), population = def?.population || castle.initialPopulation || castle.population || T.npc.population;
  const counts = [Math.floor(population * T.npc.shares.crew), Math.max(T.npc.minRunners, Math.floor(population * T.npc.shares.runner)),
    Math.max(T.npc.minMasons, Math.floor(population * T.npc.shares.mason))];
  counts.push(Math.max(0, population - counts.reduce((a, b) => a + b, 0)));
  // A standable cell can be sealed inside an expanded tower. Population must be
  // connected to the authored entry, otherwise a whole role may start imprisoned.
  const start=localCell(p,castle.rulerSpawn),reachable=new Set(),queue=[];
  if(isStandable(p,start)){reachable.add(indexOf(p,start));queue.push(start);}
  for(let head=0;head<queue.length;head++)for(const {cell} of neighbors(p,queue[head])){
    const id=indexOf(p,cell);if(!reachable.has(id)){reachable.add(id);queue.push(cell);}
  }
  const accessible=c=>reachable.has(indexOf(p,c));
  const spots = (castle.workSpots ?? []).map(pos => localCell(p, pos)).filter(c => isStandable(p, c)&&accessible(c));
  for (const box of castle.shelters ?? []) for (let y = box[1]; y <= box[4]; y++) for (let z = box[2]; z <= box[5]; z++) for (let x = box[0]; x <= box[3]; x++) {
    const c = [x, y, z]; if (isStandable(p, c)&&accessible(c)) spots.push(c);
  }
  const unique = new Map(spots.map(c => [indexOf(p, c), c]));
  if (unique.size < population) {
    const origin = spots[0] ?? localCell(p, castle.rulerSpawn ?? feet(p, [0, 1, 0])), extras = [];
    for (let i = p.width * p.depth; i < p.type.length; i++) { const c = cellOf(p, i); if (isStandable(p, c)&&accessible(c)) extras.push(c); }
    extras.sort((a, b) => manhattan(a, origin) - manhattan(b, origin) || indexOf(p, a) - indexOf(p, b));
    for (const c of extras) { unique.set(indexOf(p, c), c); if (unique.size >= population) break; }
  }
  let cells = [...unique.values()];
  // Mirror role placement together with the attack direction on a symmetric plot.
  // Asymmetric templates keep their authored valid rooms rather than spawning in masonry.
  const mirrored = cells.map(c=>[p.width-1-c[0],c[1],c[2]]);
  if (castle.facingDeg===270 && mirrored.every(c=>isStandable(p,c)&&accessible(c))) cells=mirrored;
  if (!cells.length) throw new Error(`Castle ${castle.id} has no standable population spawn`);
  const rng = api.rng(`${RNG_STREAM.NPC}:${castle.slot}`);
  api.state.nextEntityId ??= Math.max(K.MAX_SLOTS, ...api.state.npcs.map(n => n.id + 1));
  let ordinal = 0;
  for (let r = 0; r < roles.length; r++) for (let i = 0; i < counts[r] && ordinal < population; i++, ordinal++) {
    const type = roleDefinition(roles[r], i, counts[r]), pos = feet(p, cells[ordinal % cells.length]);
    const npc = { id: api.state.nextEntityId++, castle: castle.id, slot: castle.slot, role: roles[r], state: NPC_STATE.IDLE,
      pos, prevPos: { ...pos }, hp: type?.hp ?? T.people.hp, height: T.people.height, radius: T.people.npcRadius,
      carrying: 0, target: null, path: [], pathIndex: 0, pathNavVersion: p.navVersion, jobId: null,
      bravery: rng() * 2 - 1, fleeing: false, deserting: false, deserted: false, lastProgressTick: api.tick, nextPlanTick: 0 };
    setRole(npc, roles[r], type); api.state.npcs.push(npc);
  }
  api.state.npcs.sort((a, b) => a.id - b.id);
  castle.population = castle.initialPopulation = population; castle.lastDraftTick = api.tick;
}

function draft(api, castle, npcs) {
  const alive = npcs.filter(n => n.hp > 0 && !n.deserting), count = role => alive.filter(n => n.role === role).length;
  const ordered = ownWeapons(api,castle).filter(w=>w.hp>0&&w.crewOrdered);
  const minimumCrew = ordered.reduce((n,w)=>n+Math.ceil(weaponDef(w).crewSlots*T.weaponRules.minCrewFrac),0);
  const fullCrew = ordered.reduce((n,w)=>n+weaponDef(w).crewSlots,0);
  const crewNeeded = Math.min(fullCrew,Math.max(minimumCrew,alive.length-T.npc.minRunners-T.npc.minMasons));
  // Release civilian conscripts when their crew order is no longer needed.
  let crew = count(ROLE.CREW);
  for (const npc of [...alive].reverse()) if (npc.drafted && npc.role === ROLE.CREW && crew > crewNeeded) {
    releaseClaim(castle, npc); setRole(npc, ROLE.CIVILIAN); npc.drafted = false; crew--;
  }
  castle.lastDraftTick ??= 0;
  const levy = alive.length < castle.initialPopulation * T.npc.levyBelowPopFrac;
  if (api.tick - castle.lastDraftTick < ticks(levy ? T.npc.levyEveryS : T.npc.draftEveryS)) return;
  const role = levy && crew < crewNeeded ? ROLE.CREW : count(ROLE.RUNNER) < T.npc.minRunners ? ROLE.RUNNER : count(ROLE.MASON) < T.npc.minMasons ? ROLE.MASON : crew < crewNeeded ? ROLE.CREW : null;
  const candidate = alive.find(n => n.role === ROLE.CIVILIAN && !n.fleeing);
  if (role && candidate) { releaseClaim(castle, candidate); setRole(candidate, role); candidate.drafted = true; castle.lastDraftTick = api.tick; }
}

function startDesertion(api, castle, npcs) {
  const lowTicks = castle.moraleState?.desertTicks ?? 0;
  if (lowTicks <= ticks(T.npc.desertAfterS)) return;
  if (castle.lastDesertTick !== undefined && api.tick - castle.lastDesertTick < ticks(T.npc.desertEveryS)) return;
  const priority = [ROLE.CIVILIAN, ROLE.RUNNER, ROLE.MASON, ROLE.CREW];
  const npc = npcs.filter(n => n.hp > 0 && !n.deserting).sort((a, b) => priority.indexOf(a.role) - priority.indexOf(b.role) || b.id - a.id)[0];
  if (!npc) return;
  releaseClaim(castle, npc); npc.deserting = true; npc.fleeing = false; npc.shelterCell = null; npc.state = NPC_STATE.FLEE;
  npc.nextPlanTick = api.tick; castle.lastDesertTick = api.tick;
  api.emit(EV.NPC_DESERTED, { entityId: npc.id, castle: castle.id });
}

function walkToShelter(api, castle, npc, npcs) {
  if (npc.shelterCell && isStandable(castle.plot, npc.shelterCell) && (npc.pathIndex < npc.path.length || npc.state === NPC_STATE.SHELTER)) return;
  npc.shelterCell = null;
  if (api.tick < (npc.nextPlanTick ?? 0)) return;
  const occupied = new Set(npcs.filter(n => n.id !== npc.id && n.hp > 0 && !n.deserting && n.shelterCell).map(n => indexOf(castle.plot, n.shelterCell)));
  const free = shelterCells(castle).filter(c => !occupied.has(indexOf(castle.plot, c)));
  const path = planPath(api, castle, npc, free);
  if (path === undefined) return;
  npc.nextPlanTick = api.tick + ticks(T.npc.pathReplanMinS);
  if (!path) return;
  setPath(api, castle, npc, path); npc.shelterCell = [...path.at(-1)]; npc.target = { cell: [...npc.shelterCell] };
  npc.state = path.length === 1 ? NPC_STATE.SHELTER : NPC_STATE.FLEE;
}

/** Idle bodies must not permanently occupy destroyed access blocks from the blueprint. */
function blocksOriginal(castle,npc) {
  const def=castleDef(castle);if(!def)return false;
  const p=castle.plot,o=p.origin,r=npc.radius ?? T.people.npcRadius,h=npc.height ?? T.people.height;
  for(let y=Math.floor(npc.pos.y-o.y);y<=Math.floor(npc.pos.y+h-o.y-1e-9);y++)
    for(let z=Math.floor(npc.pos.z-o.z-r);z<=Math.floor(npc.pos.z-o.z+r-1e-9);z++)
      for(let x=Math.floor(npc.pos.x-o.x-r);x<=Math.floor(npc.pos.x-o.x+r-1e-9);x++){
        const cell=[x,y,z],char=def.layers[y-1]?.[z]?.[x],entry=def.legend[char];
        if(!entry||typeAt(p,cell)!==BLOCK.AIR)continue;
        const block=getBlockByKey(typeof entry==='object'?entry.key ?? entry.type:entry);
        if((block?.solid||block?.climbable)&&block.cost!==null&&personOverlapsCell(p,cell,npc))return true;
      }
  return false;
}

/** Lane entry point, tick step seven: emit/expire jobs, then brains and work by NPC id. */
export function npcTick(api, castle) {
  spawnPopulation(api, castle);
  if (castle.npcBrainTick === api.tick) return;
  castle.npcBrainTick = api.tick;
  emitJobs(api, castle); expireClaims(api, castle);
  const npcs = ownNpcs(api, castle);
  draft(api, castle, npcs); startDesertion(api, castle, npcs);
  for (const npc of npcs) {
    if (npc.hp <= 0) {
      releaseClaim(castle, npc); npc.state = NPC_STATE.DEAD; npc.carrying = 0;
      if (!npc.deathHandled) {
        npc.deathHandled = true; castle.stats && castle.stats.losses++;
        queueMoraleInput(castle, { deaths: [{ entityId: npc.id, role: npc.role }] });
        if (!npc.dead) api.emit(EV.NPC_DIED, { entityId: npc.id, role: npc.role, castle: castle.id, cause: 'damage' });
        npc.dead = true;
      }
      continue;
    }
    if (npc.falling) continue;
    if (npc.deserting) {
      const exit = localCell(castle.plot, castle.exit ?? castle.rulerSpawn);
      if (distanceSq(npc.pos, feet(castle.plot, exit)) <= T.people.npcRadius * T.people.npcRadius) { npc.deserted = true; continue; }
      if (npc.pathIndex >= npc.path.length && api.tick >= (npc.nextPlanTick ?? 0)) {
        const path = planPath(api, castle, npc, [exit]);
        if (path !== undefined) { npc.nextPlanTick = api.tick + ticks(T.npc.pathReplanMinS); if (path) { setPath(api, castle, npc, path); npc.state = NPC_STATE.FLEE; } }
      }
      continue;
    }
    if (!npc.fleeing && castle.morale < npc.fleeThreshold) {
      releaseClaim(castle, npc); npc.fleeing = true; npc.state = NPC_STATE.FLEE; npc.nextPlanTick = api.tick;
      api.emit(EV.NPC_FLED, { entityId: npc.id, castle: castle.id });
    } else if (npc.fleeing && castle.morale > npc.fleeThreshold + T.npc.returnHysteresis) {
      npc.fleeing = false; api.emit(EV.NPC_RETURNED, { entityId: npc.id, castle: castle.id });
    }
    const ordered = castle.shelter && (npc.role === ROLE.CIVILIAN || npc.role === ROLE.RUNNER && !npc.carrying);
    if (npc.fleeing || ordered) {
      if (npc.jobId !== null && npc.jobId !== undefined) releaseClaim(castle, npc);
      if (npc.state !== NPC_STATE.FLEE && npc.state !== NPC_STATE.SHELTER) { npc.path = []; npc.pathIndex = 0; npc.state = NPC_STATE.FLEE; npc.nextPlanTick = api.tick; }
      walkToShelter(api, castle, npc, npcs); continue;
    }
    if (npc.shelterCell || npc.state === NPC_STATE.FLEE || npc.state === NPC_STATE.SHELTER) {
      npc.shelterCell = null; npc.path = []; npc.pathIndex = 0; npc.target = null; npc.state = NPC_STATE.IDLE;
    }
    if (npc.state === NPC_STATE.WORK && npc.jobId == null) npc.state = NPC_STATE.IDLE;
    const gunBlocked=ownWeapons(api,castle).some(w=>blocksWeaponMuzzle(w,npc));
    const held=castle.jobs?.find(j=>j.id===npc.jobId);
    if((npc.state===NPC_STATE.IDLE||held?.kind===JOB.REPAIR&&held.priority===0||held?.kind===JOB.CREW&&gunBlocked)&&api.tick>=(npc.nextPlanTick ?? 0)&&(blocksOriginal(castle,npc)||gunBlocked)){
      const goals=outsideBuildSites(castle,npc,workCells(castle.plot,localCell(castle.plot,npc.pos),T.npc.workReachM+T.npc.clamberMaxRiseM),[],api.state.weapons).filter(c=>!blocksOriginal(castle,{...npc,pos:feet(castle.plot,c)}));
      const path=planPath(api,castle,npc,goals);
      if(path?.length>1){releaseClaim(castle,npc);setPath(api,castle,npc,path);continue;}
    }
    if (npc.state === NPC_STATE.IDLE && npc.jobId == null) {
      const empty = (castle.mountSpots ?? []).find(spot => {
        const pos = feet(castle.plot, spot);
        return !ownWeapons(api, castle).some(w => w.hp > 0 && distanceSq(w.pos, pos) < 0.01)
          && personOverlapsWeaponSite(castle.plot, spot, 'cannon', npc);
      });
      if (empty) {
        const path = planPath(api, castle, npc, weaponWorkCells(castle, { pos: feet(castle.plot, empty), defId: 'cannon' }, npc));
        if (path) { setPath(api, castle, npc, path); continue; }
      }
    }
    const type = npc.typeId ? getNpcType(npc.typeId) : null;
    if (npc.state === NPC_STATE.IDLE || npc.state === NPC_STATE.CLAIM) claimJob(api, castle, npc, type?.pickJob);
    if (npc.state === NPC_STATE.WORK) tickWork(api, castle, npc);
  }
  api.state.npcs = api.state.npcs.filter(n => !n.deserted);
  castle.population = npcs.filter(n => n.hp > 0 && !n.deserting).length;
  castle.civiliansWorking = npcs.filter(n => n.hp > 0 && !n.deserting && n.role === ROLE.CIVILIAN && n.state === NPC_STATE.WORK).length;
  updateCrews(api, castle);
}

// src/npc/jobs.js - owns job emission, exclusive claims, work and ammunition logistics.
import { BLOCK, META, JOB, ROLE, NPC_STATE, EV, K } from '../contracts.js';
import { TUNING as T } from '../tuning.js';
import { blockDef, cellOf, indexOf, typeAt, localCell, feet, distanceSq, manhattan, ticks,
  ownNpcs, ownWeapons, weaponDef, workSpeed, jobScanVersion, missingWeaponCost, blocksWeaponMuzzle } from './model.js';
import { buildSiteReady, personOverlapsCell, personOverlapsWeaponSite } from './designations.js';
import { refund, demolitionRefund } from '../sim/economy.js';
import { isStandable, pathValid, findPathToAny } from './path.js';

const scanCache = new WeakMap(), EMPTY_DESIGNATIONS = Object.freeze([]);
const axes = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const keyOf = (kind, target) => `${kind}:${target.weaponId ?? target.cell.join(',')}`;
const emit = (api, type, job) => api.emit(type, { jobId: job.id, kind: job.kind, castle: job.castle });

/** Reconcile connected stores after topology changes; economy owns their restock timer. */
export function discoverMagazines(api, castle) {
  const p = castle.plot;
  if (castle.magazineNavVersion === p.navVersion) return;
  const old = castle.magazines ?? [], seen = new Set(), stores = [];
  for (let i = 0; i < p.type.length; i++) {
    if (p.type[i] !== BLOCK.MAGAZINE || seen.has(i)) continue;
    const cells = [i]; seen.add(i);
    for (let head = 0; head < cells.length; head++) {
      const c = cellOf(p, cells[head]);
      for (const d of axes) { const n = indexOf(p, c.map((v, k) => v + d[k]));
        if (n >= 0 && p.type[n] === BLOCK.MAGAZINE && !seen.has(n)) { seen.add(n); cells.push(n); }
      }
    }
    cells.sort((a, b) => a - b);
    const previous = old.filter(m => m.cells?.some(c => cells.includes(c)));
    // Splitting a store must not duplicate its stock: retain it only in its first component.
    const stock = previous.length ? previous.reduce((s, m) => s + (seen.has(m.cells[0]) && cells.includes(m.cells[0]) ? m.stock : 0), 0) : T.magazine.capacityLoads;
    stores.push({ id: cells[0], cells, stock: Math.min(T.magazine.capacityLoads, stock), restock: previous[0]?.restock ?? 0 });
  }
  castle.magazines = stores; castle.magazineNavVersion = p.navVersion;
}

/** Add one deduplicated, stable-id job to the castle queue. */
export function addJob(api, castle, kind, target, { priority = 0, slots = 1, role, block, weapon } = {}) {
  castle.jobs ??= []; castle.nextJobId ??= 1;
  const key = keyOf(kind, target), existing = castle.jobs.find(j => j.key === key);
  if (existing) { existing.priority = Math.max(existing.priority, priority); existing.slots = slots; return existing; }
  const job = { id: castle.nextJobId++, key, kind, castle: castle.id, target, priority, role: role ??
    (kind === JOB.CREW ? ROLE.CREW : kind === JOB.HAUL_AMMO ? ROLE.RUNNER : kind === JOB.WORK ? ROLE.CIVILIAN : ROLE.MASON),
    slots, claimedBy: [], reachable: true, blockedUntilTick: 0, createdTick: api.tick, progress: 0, block: block ?? null, ...(weapon ? { weapon } : {}) };
  castle.jobs.push(job); emit(api, EV.JOB_CREATED, job); return job;
}

/** World-driven emitters use the current arrays, so damage is visible in tick step seven. */
export function emitJobs(api, castle) {
  castle.jobs ??= [];
  discoverMagazines(api, castle);
  const p = castle.plot;
  // Enemy destruction can finish a demolition before its mason arrives.
  if (castle.npcDesignations?.some(d => !(p.meta[indexOf(p, d.cell)] & META.DESIGNATED_BIT))) {
    castle.npcDesignations = castle.npcDesignations.filter(d => {
      if (p.meta[indexOf(p, d.cell)] & META.DESIGNATED_BIT) return true;
      refund(castle, d.reserved ?? 0); return false;
    });
  }
  const designations = castle.npcDesignations ?? castle.designations ?? EMPTY_DESIGNATIONS;
  const cached = scanCache.get(p), damage = jobScanVersion(p);
  if (!cached || cached.nav !== p.navVersion || cached.damage !== damage || cached.designations !== designations || cached.count !== designations.length) {
    scanCache.set(p, { nav: p.navVersion, damage, designations, count: designations.length });
    for (let i = p.width * p.depth; i < p.type.length; i++) {
    const id = p.type[i];
    if (id) { const def = blockDef(id);
      if (def && p.hp[i] > 0 && p.hp[i] < def.hp * T.npc.repairJobBelow) addJob(api, castle, JOB.REPAIR, { cell: cellOf(p, i) });
    }
    if (p.meta[i] & META.DESIGNATED_BIT) {
      const cell = cellOf(p, i), designation = designations.find(d => indexOf(p, d.cell) === i);
      addJob(api, castle, designation?.kind ?? JOB.BUILD, { cell }, { priority: designation?.weapon || [BLOCK.MAGAZINE,BLOCK.MOUNT,BLOCK.STAIRS,BLOCK.FLOOR].includes(designation?.block) ? 2 : 1, block: designation?.weapon ? BLOCK.AIR : designation?.block ?? BLOCK.STONE, weapon: designation?.weapon });
    }
  }
  }
  const weapons = ownWeapons(api,castle).filter(w=>w.hp>0), ordered=weapons.filter(w=>w.crewOrdered);
  const minimum = ordered.reduce((n,w)=>n+Math.ceil(weaponDef(w).crewSlots*T.weaponRules.minCrewFrac),0);
  let extras=Math.max(0,ownNpcs(api,castle).filter(n=>n.hp>0&&!n.deserting&&!n.fleeing&&n.role===ROLE.CREW).length-minimum);
  for (const weapon of weapons) {
    if (weapon.crewOrdered) {
      const full=weaponDef(weapon).crewSlots,min=Math.ceil(full*T.weaponRules.minCrewFrac),slots=Math.min(full,min+extras);
      extras-=slots-min;
      const job=addJob(api,castle,JOB.CREW,{weaponId:weapon.id},{priority:3,slots});
      for(const id of job.claimedBy.slice(slots)){const npc=ownNpcs(api,castle).find(n=>n.id===id);if(npc)releaseClaim(castle,npc);}
    }
    if (weapon.ammo < T.weaponRules.bufferLoads) addJob(api, castle, JOB.HAUL_AMMO, { weaponId: weapon.id }, { priority: weapon.ammoPriority ? 3 : 2 });
  }
  for (const pos of castle.workSpots ?? []) addJob(api, castle, JOB.WORK, { cell: localCell(p, pos) });
  for (const job of [...castle.jobs]) {
    if (!job.reachable && api.tick >= job.blockedUntilTick) job.reachable = true;
    const i = job.target.cell ? indexOf(p, job.target.cell) : -1;
    const w = job.target.weaponId === undefined ? null : ownWeapons(api, castle).find(w => w.id === job.target.weaponId);
    const obsolete = job.kind === JOB.REPAIR && (i < 0 || !p.type[i] || p.hp[i] >= blockDef(p.type[i]).hp)
      || (job.kind === JOB.BUILD || job.kind === JOB.DEMOLISH) && !(p.meta[i] & META.DESIGNATED_BIT)
      || job.target.weaponId !== undefined && (!w || w.hp <= 0 || job.kind === JOB.CREW && !w.crewOrdered
        || job.kind === JOB.HAUL_AMMO && w.ammo >= T.weaponRules.bufferLoads && !job.claimedBy.length);
    if (obsolete) finishJob(api, castle, job);
  }
}

/** Masons stand at any legal cell within work reach of the block centre. */
export function workCells(plot, target, reach = T.npc.workReachM) {
  const cells = [], r = Math.floor(reach);
  for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    if (dx * dx + dy * dy + dz * dz > reach * reach) continue;
    const c = [target[0] + dx, target[1] + dy, target[2] + dz]; if (isStandable(plot, c)) cells.push(c);
  }
  return cells.sort((a, b) => indexOf(plot, a) - indexOf(plot, b));
}

/** Keep people outside the weapon hull and its future replacement footprint. */
export function weaponWorkCells(castle, weapon, npc) {
  const cell = localCell(castle.plot, weapon.pos);
  return workCells(castle.plot, cell).filter(c => !blocksWeaponMuzzle(weapon,{...npc,pos:feet(castle.plot,c)})&&!personOverlapsWeaponSite(castle.plot, cell, weapon.defId,
    { ...npc, pos: feet(castle.plot, c) }));
}

/** Work destinations must leave every reserved construction footprint clear. */
export function outsideBuildSites(castle,npc,cells,extra=[],weapons=[]) {
  const sites=[...extra,...(castle.npcDesignations ?? []).filter(d=>d.kind===JOB.BUILD)];
  return cells.filter(c=>!weapons.some(w=>w.slot===castle.slot&&blocksWeaponMuzzle(w,{...npc,pos:feet(castle.plot,c)}))&&!sites.some(d=>d.weapon?personOverlapsWeaponSite(castle.plot,d.cell,d.weapon,{...npc,pos:feet(castle.plot,c)}):personOverlapsCell(castle.plot,d.cell,{...npc,pos:feet(castle.plot,c)})));
}

/** Fear affects BUILD/REPAIR only; one highest-priority job breaks sustained-fire deadlock. */
export function fearAllows(api, castle, job) {
  if(job.kind===JOB.REPAIR&&job.priority===0&&typeAt(castle.plot,job.target.cell)!==BLOCK.PALACE){
    const pos=feet(castle.plot,job.target.cell);
    if((castle.enemyImpacts ?? []).some(e=>api.tick-e.tick<ticks(T.npc.autoRepairQuietS)&&distanceSq(pos,e.pos)<=T.npc.fearRadiusM*T.npc.fearRadiusM))return false;
  }
  if (job.kind !== JOB.BUILD && job.kind !== JOB.REPAIR || castle.morale >= T.npc.fearMoraleOverride) return true;
  if (castle.fearOverrideJobId === job.id) return true;
  const pos = feet(castle.plot, job.target.cell);
  const afraid = (castle.enemyImpacts ?? []).some(e => api.tick - e.tick < ticks(T.npc.fearWindowS)
    && distanceSq(pos, e.pos) <= T.npc.fearRadiusM * T.npc.fearRadiusM);
  if (!afraid) return true;
  if (api.tick - (castle.lastRepairProgressTick ?? 0) < ticks(T.npc.fearDeadlockS)) return false;
  const first = castle.jobs.filter(j => (j.kind === JOB.REPAIR || j.kind === JOB.BUILD) && j.reachable && buildReady(api, castle, j))
    .sort((a, b) => b.priority - a.priority || a.id - b.id)[0];
  if (first?.id === job.id) { castle.fearOverrideJobId = job.id; return true; }
  return false;
}

function buildReady(api, castle, job) {
  if (job.kind !== JOB.BUILD) return true;
  return buildSiteReady(castle, job.target.cell, api.state, job.weapon);
}

/** Shared FIFO search allowance: callers process NPCs in id order. */
export function planPath(api, castle, npc, goals) {
  if (castle.npcSearchTick !== api.tick) { castle.npcSearchTick = api.tick; castle.npcSearchCount = 0; }
  if (castle.npcSearchCount >= T.npc.pathSearchesPerTick) return undefined;
  castle.npcSearchCount++;
  return findPathToAny(castle.plot, localCell(castle.plot, npc.pos), goals);
}

/** Install a cell list without moving the entity in the brain stage. */
export function setPath(api, castle, npc, path) {
  npc.path = path; npc.pathIndex = path.length > 1 ? 1 : path.length; npc.pathNavVersion = castle.plot.navVersion;
  npc.nextPlanTick = api.tick + ticks(T.npc.pathReplanMinS); npc.lastProgressTick = api.tick;
  npc.state = npc.pathIndex < path.length ? NPC_STATE.WALK : NPC_STATE.WORK;
}

function blockWorker(api, job, npc) {
  (job.blockedNpcUntil ??= {})[npc.id]=api.tick+ticks(T.npc.claimBlockedS);
  emit(api,EV.JOB_UNREACHABLE,job);
}

function matching(npc, job) { return npc.jobs ? npc.jobs.includes(job.kind) : npc.role === job.role || npc.role === ROLE.CREW && job.kind === JOB.HAUL_AMMO; }
function goalsFor(api, castle, npc, job) {
  if (job.target.cell) {
    const cells = job.kind === JOB.WORK ? [job.target.cell] : workCells(castle.plot, job.target.cell);
    return outsideBuildSites(castle,npc,cells,job.kind===JOB.BUILD?[{...job.target,weapon:job.weapon}]:[],api.state.weapons);
  }
  const w = ownWeapons(api, castle).find(w => w.id === job.target.weaponId);
  if (job.kind === JOB.CREW) return outsideBuildSites(castle,npc,weaponWorkCells(castle,w,npc),[],api.state.weapons);
  if (npc.carrying > 0) { npc.haulStage = 'deposit'; return outsideBuildSites(castle,npc,weaponWorkCells(castle,w,npc),[],api.state.weapons); }
  const stores = castle.magazines.filter(m => m.stock > 0);
  npc.haulStage = 'pickup';
  return outsideBuildSites(castle,npc,stores.flatMap(m=>m.cells.flatMap(i=>workCells(castle.plot,cellOf(castle.plot,i),1))),[],api.state.weapons);
}

/** Idle workers pull priority/distance/id jobs, with plugin pickJob as an optional preference. */
export function claimJob(api, castle, npc, pickJob = null) {
  if (npc.hp <= 0 || npc.jobId !== null && npc.jobId !== undefined || api.tick < (npc.nextPlanTick ?? 0)) return null;
  const start = localCell(castle.plot, npc.pos);
  const candidates = castle.jobs.filter(j => j.reachable && (j.blockedNpcUntil?.[npc.id] ?? 0)<=api.tick && matching(npc, j) && j.claimedBy.length < j.slots
    && fearAllows(api, castle, j) && buildReady(api, castle, j));
  candidates.sort((a, b) => b.priority - a.priority || manhattan(start, a.target.cell ?? localCell(castle.plot, ownWeapons(api, castle).find(w => w.id === a.target.weaponId).pos))
    - manhattan(start, b.target.cell ?? localCell(castle.plot, ownWeapons(api, castle).find(w => w.id === b.target.weaponId).pos)) || a.id - b.id);
  const picker = pickJob ?? npc.pickJob;
  if (picker) {
    const id = picker(api, npc, candidates), i = candidates.findIndex(j => j.id === id);
    if (i < 0) return null;
    if (i > 0) candidates.unshift(...candidates.splice(i, 1));
  }
  for (const job of candidates) {
    const goals = goalsFor(api, castle, npc, job);
    if (!goals.length && job.kind === JOB.HAUL_AMMO) continue;
    const path = planPath(api, castle, npc, goals);
    if (path === undefined) return null;
    if (!path) { blockWorker(api,job,npc); continue; }
    if(job.blockedNpcUntil) delete job.blockedNpcUntil[npc.id];
    npc.jobId = job.id; npc.target = { ...job.target }; job.claimedBy.push(npc.id); job.claimedBy.sort((a, b) => a - b);
    setPath(api, castle, npc, path); emit(api, EV.JOB_CLAIMED, job); return job;
  }
  return null;
}

/** Drop the exclusive claim while preserving carried loads until deposit or death. */
export function releaseClaim(castle, npc) {
  const job = castle.jobs?.find(j => j.id === npc.jobId);
  if (job) job.claimedBy = job.claimedBy.filter(id => id !== npc.id);
  npc.jobId = null; npc.target = null; npc.path = []; npc.pathIndex = 0;
  if (npc.state === NPC_STATE.WALK || npc.state === NPC_STATE.WORK || npc.state === NPC_STATE.CLAIM) npc.state = NPC_STATE.IDLE;
}

/** Release invalid claimants before assigning any new jobs. */
export function expireClaims(api, castle) {
  for (const npc of ownNpcs(api, castle)) {
    if (npc.jobId === null || npc.jobId === undefined) continue;
    const held = castle.jobs?.find(j=>j.id===npc.jobId);
    const urgent = held?.kind===JOB.REPAIR && held.priority===0 && castle.jobs.some(j=>j.kind===JOB.BUILD
      && j.priority>held.priority && j.priority>=2 && j.reachable && j.claimedBy.length<j.slots && buildReady(api,castle,j));
    const preempted = urgent || npc.hp <= 0 || npc.deserting || npc.state === NPC_STATE.FLEE || npc.state === NPC_STATE.SHELTER || npc.state === NPC_STATE.DEAD;
    const broken = npc.pathNavVersion !== castle.plot.navVersion && !pathValid(castle.plot, npc.path, Math.max(0, npc.pathIndex - 1));
    if (preempted || broken || api.tick - npc.lastProgressTick > ticks(T.npc.claimTimeoutS)) releaseClaim(castle, npc);
    else npc.pathNavVersion = castle.plot.navVersion;
  }
}

/** Complete/cancel once and immediately release every claimant. */
export function finishJob(api, castle, job) {
  if (!castle.jobs.includes(job)) return;
  for (const npc of ownNpcs(api, castle)) if (npc.jobId === job.id) releaseClaim(castle, npc);
  castle.jobs = castle.jobs.filter(j => j.id !== job.id);
  if (castle.fearOverrideJobId === job.id) castle.fearOverrideJobId = null;
  emit(api, EV.JOB_DONE, job);
}

/** Work advances only after path arrival; loading and hauling use the same public job rules. */
export function tickWork(api, castle, npc) {
  const job = castle.jobs?.find(j => j.id === npc.jobId);
  if (!job || npc.state !== NPC_STATE.WORK || !fearAllows(api, castle, job)) return;
  const p = castle.plot, speed = workSpeed(castle, npc), cell = job.target.cell, i = cell ? indexOf(p, cell) : -1;
  if (job.kind === JOB.CREW || job.kind === JOB.WORK) { npc.lastProgressTick = api.tick; return; }
  if (job.kind === JOB.HAUL_AMMO) {
    const weapon = ownWeapons(api, castle).find(w => w.id === job.target.weaponId);
    if (!weapon || weapon.hp <= 0) { finishJob(api, castle, job); return; }
    if (npc.haulStage === 'pickup') {
      if (api.tick < (npc.nextPlanTick ?? 0)) return;
      const store = castle.magazines.filter(m => m.stock > 0 && m.cells.some(i => manhattan(localCell(p, npc.pos), cellOf(p, i)) <= 1)).sort((a, b) => a.id - b.id)[0];
      if (!store) { releaseClaim(castle, npc); return; }
      const path = planPath(api, castle, npc, outsideBuildSites(castle,npc,weaponWorkCells(castle,weapon,npc),[],api.state.weapons));
      if (path === undefined) return;
      if (!path) { blockWorker(api,job,npc); releaseClaim(castle,npc); return; }
      npc.carrying = Math.min(T.npc.carryLoads, store.stock); store.stock -= npc.carrying; npc.haulStage = 'deposit'; setPath(api, castle, npc, path);
    } else {
      const loads = Math.min(npc.carrying, T.weaponRules.bufferLoads - weapon.ammo);
      weapon.ammo += loads; npc.carrying -= loads; finishJob(api, castle, job);
    }
    return;
  }
  if (job.kind === JOB.REPAIR) {
    const def = blockDef(p.type[i]); if (!def || !p.type[i]) { finishJob(api, castle, job); return; }
    const rate = def.hp / T.npc.repairFullS * speed * K.DT;
    const unitCost = (def.cost ?? T.economy.mapOnlyRepairBlockCost) * T.economy.repairCostFrac / def.hp;
    job.repairRemainder = (job.repairRemainder ?? 0) + rate;
    const live = ownWeapons(api, castle).filter(w => w.hp > 0);
    const critical = live.filter(w => w.hp <= weaponDef(w).hp * T.ai.recoveryGunHpFrac);
    const missingCost = missingWeaponCost(castle.weapons,live);
    const costs = missingCost ? [missingCost] : critical.map(w => weaponDef(w).cost);
    const reserve = job.priority > 0 ? 0 : Math.max(costs.length ? Math.min(...costs) : 0, ...live.map(w => weaponDef(w).fireCost), 0);
    const available = Math.max(0, castle.gold - reserve);
    const amount = Math.min(def.hp - p.hp[i], Math.floor(job.repairRemainder + 1e-9), unitCost > 0 ? Math.floor(available / unitCost) : def.hp);
    if (amount > 0) { p.hp[i] += amount; job.repairRemainder -= amount; castle.gold -= amount * unitCost;
      job.progress = p.hp[i] / def.hp; npc.lastProgressTick = api.tick; castle.lastRepairProgressTick = api.tick;
      api.emit(EV.BLOCK_DAMAGED, { plot: castle.id, cell, id: p.type[i], hp: p.hp[i], state: Math.min(T.damageStateAbove.length, T.damageStateAbove.filter(t => job.progress <= t).length) });
    }
    if (p.hp[i] >= def.hp) finishJob(api, castle, job);
    return;
  }
  if (!buildReady(api, castle, job)) return;
  const def = blockDef(job.block ?? p.type[i]);
  if (!job.weapon && (!def || job.kind === JOB.DEMOLISH && p.type[i] === BLOCK.AIR)) { finishJob(api, castle, job); return; }
  const buildS = job.weapon ? (weaponDef({ defId: job.weapon }).mount === 'ground' ? T.weaponRules.buildGroundS : T.weaponRules.buildWallS) : def.buildS;
  job.progress = Math.min(1, job.progress + speed * K.DT / Math.max(K.DT, buildS)); npc.lastProgressTick = api.tick;
  if (job.kind === JOB.BUILD) castle.lastRepairProgressTick = api.tick;
  if (job.progress >= 1 - 1e-9) {
    const previous = p.type[i], block = job.kind === JOB.DEMOLISH ? BLOCK.AIR : job.block;
    let weaponId;
    if (job.weapon) {
      weaponId = api.placeWeapon(castle.slot, job.weapon, cell, p.meta[i] & META.FACING_MASK);
      p.meta[i] = 0;
    } else {
      api.setBlock(feet(p, cell), block, p.meta[i] & ~META.DESIGNATED_BIT);
      if (job.kind === JOB.DEMOLISH) refund(castle, demolitionRefund(def.cost));
    }
    castle.npcDesignations = (castle.npcDesignations ?? []).filter(d => indexOf(p, d.cell) !== i);
    api.emit(job.weapon || block !== BLOCK.AIR ? EV.BLOCK_BUILT : EV.BLOCK_DESTROYED, { plot: castle.id, cell, id: block === BLOCK.AIR ? previous : block, ...(job.weapon ? { weapon: job.weapon, weaponId } : {}) }); finishJob(api, castle, job);
  }
}

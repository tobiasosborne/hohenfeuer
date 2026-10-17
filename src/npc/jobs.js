// src/npc/jobs.js - owns job emission, exclusive claims, work and ammunition logistics.
import { BLOCK, META, JOB, ROLE, NPC_STATE, EV, K } from '../contracts.js';
import { TUNING as T } from '../tuning.js';
import { blockDef, cellOf, indexOf, typeAt, localCell, feet, distanceSq, manhattan, ticks,
  ownNpcs, ownWeapons, operatorCell, weaponDef, workSpeed } from './model.js';
import { isStandable, pathValid, findPathToAny } from './path.js';

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
export function addJob(api, castle, kind, target, { priority = 0, slots = 1, role, block } = {}) {
  castle.jobs ??= []; castle.nextJobId ??= 1;
  const key = keyOf(kind, target), existing = castle.jobs.find(j => j.key === key);
  if (existing) { existing.priority = Math.max(existing.priority, priority); existing.slots = slots; return existing; }
  const job = { id: castle.nextJobId++, key, kind, castle: castle.id, target, priority, role: role ??
    (kind === JOB.CREW ? ROLE.CREW : kind === JOB.HAUL_AMMO ? ROLE.RUNNER : kind === JOB.WORK ? ROLE.CIVILIAN : ROLE.MASON),
    slots, claimedBy: [], reachable: true, blockedUntilTick: 0, createdTick: api.tick, progress: 0, block: block ?? null };
  castle.jobs.push(job); emit(api, EV.JOB_CREATED, job); return job;
}

/** World-driven emitters use the current arrays, so damage is visible in tick step seven. */
export function emitJobs(api, castle) {
  castle.jobs ??= [];
  discoverMagazines(api, castle);
  const p = castle.plot, designations = castle.npcDesignations ?? castle.designations ?? [];
  for (let i = p.width * p.depth; i < p.type.length; i++) {
    const id = p.type[i];
    if (id) { const def = blockDef(id);
      if (def && p.hp[i] > 0 && p.hp[i] < def.hp * T.npc.repairJobBelow) addJob(api, castle, JOB.REPAIR, { cell: cellOf(p, i) });
    }
    if (p.meta[i] & META.DESIGNATED_BIT) {
      const cell = cellOf(p, i), designation = designations.find(d => indexOf(p, d.cell) === i);
      addJob(api, castle, designation?.kind ?? JOB.BUILD, { cell }, { priority: 1, block: designation?.block ?? BLOCK.STONE });
    }
  }
  for (const weapon of ownWeapons(api, castle)) if (weapon.hp > 0) {
    if (weapon.crewOrdered) addJob(api, castle, JOB.CREW, { weaponId: weapon.id }, { priority: 3, slots: weaponDef(weapon).crewSlots });
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

/** Fear affects BUILD/REPAIR only; one highest-priority job breaks sustained-fire deadlock. */
export function fearAllows(api, castle, job) {
  if (job.kind !== JOB.BUILD && job.kind !== JOB.REPAIR || castle.morale >= T.npc.fearMoraleOverride) return true;
  if (castle.fearOverrideJobId === job.id) return true;
  const pos = feet(castle.plot, job.target.cell);
  const afraid = (castle.enemyImpacts ?? []).some(e => api.tick - e.tick < ticks(T.npc.fearWindowS)
    && distanceSq(pos, e.pos) <= T.npc.fearRadiusM * T.npc.fearRadiusM);
  if (!afraid) return true;
  if (api.tick - (castle.lastRepairProgressTick ?? 0) < ticks(T.npc.fearDeadlockS)) return false;
  const first = castle.jobs.filter(j => (j.kind === JOB.REPAIR || j.kind === JOB.BUILD) && j.reachable)
    .sort((a, b) => b.priority - a.priority || a.id - b.id)[0];
  if (first?.id === job.id) { castle.fearOverrideJobId = job.id; return true; }
  return false;
}

function buildReady(api, castle, job) {
  if (job.kind !== JOB.BUILD) return true;
  const c = job.target.cell, p = castle.plot;
  if (typeAt(p, c) !== BLOCK.AIR) return false;
  if (api.state.npcs.some(n => n.hp > 0 && !n.deserted && n.castle === castle.id && indexOf(p, localCell(p, n.pos)) === indexOf(p, c))
    || api.state.rulers?.some(n => n.hp > 0 && n.slot === castle.slot && indexOf(p, localCell(p, n.pos)) === indexOf(p, c))) return false;
  return c[1] === T.world.buildMinY || axes.some(d => blockDef(typeAt(p, c.map((v, k) => v + d[k])))?.solid);
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

function matching(npc, job) { return npc.jobs ? npc.jobs.includes(job.kind) : npc.role === job.role || npc.role === ROLE.CREW && job.kind === JOB.HAUL_AMMO; }
function goalsFor(api, castle, npc, job) {
  if (job.target.cell) return job.kind === JOB.WORK ? [job.target.cell] : workCells(castle.plot, job.target.cell);
  const w = ownWeapons(api, castle).find(w => w.id === job.target.weaponId);
  if (job.kind === JOB.CREW) return workCells(castle.plot, localCell(castle.plot, w.pos));
  if (npc.carrying > 0) { npc.haulStage = 'deposit'; return [operatorCell(w, castle)]; }
  const stores = castle.magazines.filter(m => m.stock > 0);
  npc.haulStage = 'pickup';
  return stores.flatMap(m => m.cells.flatMap(i => workCells(castle.plot, cellOf(castle.plot, i), 1)));
}

/** Idle workers pull priority/distance/id jobs, with plugin pickJob as an optional preference. */
export function claimJob(api, castle, npc, pickJob = null) {
  if (npc.hp <= 0 || npc.jobId !== null && npc.jobId !== undefined || api.tick < (npc.nextPlanTick ?? 0)) return null;
  const start = localCell(castle.plot, npc.pos);
  const candidates = castle.jobs.filter(j => j.reachable && matching(npc, j) && j.claimedBy.length < j.slots
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
    if (!path) { job.reachable = false; job.blockedUntilTick = api.tick + ticks(T.npc.claimBlockedS); emit(api, EV.JOB_UNREACHABLE, job); continue; }
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
    const preempted = npc.hp <= 0 || npc.deserting || npc.state === NPC_STATE.FLEE || npc.state === NPC_STATE.SHELTER || npc.state === NPC_STATE.DEAD;
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
      const path = planPath(api, castle, npc, [operatorCell(weapon, castle)]);
      if (path === undefined) return;
      if (!path) { job.reachable = false; job.blockedUntilTick = api.tick + ticks(T.npc.claimBlockedS); emit(api, EV.JOB_UNREACHABLE, job); releaseClaim(castle, npc); return; }
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
    const unitCost = (def.cost ?? 0) * T.economy.repairCostFrac / def.hp;
    job.repairRemainder = (job.repairRemainder ?? 0) + rate;
    const amount = Math.min(def.hp - p.hp[i], Math.floor(job.repairRemainder + 1e-9), unitCost > 0 ? Math.floor(castle.gold / unitCost) : def.hp);
    if (amount > 0) { p.hp[i] += amount; job.repairRemainder -= amount; castle.gold -= amount * unitCost;
      job.progress = p.hp[i] / def.hp; npc.lastProgressTick = api.tick; castle.lastRepairProgressTick = api.tick;
      api.emit(EV.BLOCK_DAMAGED, { plot: castle.id, cell, id: p.type[i], hp: p.hp[i], state: Math.min(T.damageStateAbove.length, T.damageStateAbove.filter(t => job.progress <= t).length) });
    }
    if (p.hp[i] >= def.hp) finishJob(api, castle, job);
    return;
  }
  if (!buildReady(api, castle, job)) return;
  const def = blockDef(job.block ?? p.type[i]);
  job.progress = Math.min(1, job.progress + speed * K.DT / Math.max(K.DT, def.buildS)); npc.lastProgressTick = api.tick;
  if (job.kind === JOB.BUILD) castle.lastRepairProgressTick = api.tick;
  if (job.progress >= 1 - 1e-9) {
    const previous = p.type[i], block = job.kind === JOB.DEMOLISH ? BLOCK.AIR : job.block;
    api.setBlock(feet(p, cell), block, p.meta[i] & ~META.DESIGNATED_BIT);
    castle.npcDesignations = (castle.npcDesignations ?? []).filter(d => indexOf(p, d.cell) !== i);
    api.emit(block === BLOCK.AIR ? EV.BLOCK_DESTROYED : EV.BLOCK_BUILT, { plot: castle.id, cell, id: block === BLOCK.AIR ? previous : block }); finishJob(api, castle, job);
  }
}

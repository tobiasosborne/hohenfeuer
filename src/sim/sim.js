// src/sim/sim.js - owns deterministic tick orchestration, commands and complete replay snapshots.
import { BLOCK, CMD, EV, LOST_REASON, CONTROLLER, TACTIC, RNG_STREAM, K, getBlock, getBlockByKey, getWeapon, getCastle, getMap, isFrozen, registryHash, validateCommand } from '../contracts.js';
import { TUNING as T } from '../tuning.js';
import { createStreams } from '../core/rng.js';
import { hash } from '../core/hash.js';
import { xyz, cellIndex, worldToCell, getCell, setCell, raycast } from '../world/grid.js';
import { loadCastle } from '../world/castle-load.js';
import { generateTerrain, sampleHeight } from '../world/terrain.js';
import { createSupport, queueSupport, stepSupport } from '../world/support.js';
import { createWind, tickWind, windVector } from './wind.js';
import { integrateProjectile } from './ballistics.js';
import { createWeapon, tickWeapons } from './weapons.js';
import { applyBlast, damageBlock, damagePeople, damagePerson, segmentAabb, segmentCapsule, piercePerson } from './damage.js';
import { createRuler, tickRuler } from './ruler.js';
import { tickEconomy } from './economy.js';
import { createStats, checkRules } from './rules.js';
import { createAiController } from '../ai/controller.js';
import { npcTick, moraleTick, npcKinematics, recordNpcEvent, beginNpcImpact, endNpcImpact, npcCommand } from '../npc/index.js';

/** Copy state into plain records and fresh typed arrays, excluding callable plugin internals. */
function snapshot(value) {
  if (ArrayBuffer.isView(value)) return value.slice();
  if (Array.isArray(value)) return value.map(snapshot);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v !== 'function').map(([k, v]) => [k, snapshot(v)]));
  return value;
}
function encode(value) { return JSON.stringify(value, (_key, v) => v instanceof Uint8Array ? { bytes: [...v] } : v instanceof Float64Array ? { doubles: [...v] } : typeof v === 'function' ? undefined : v); }
function decode(text) { return JSON.parse(text, (_key, v) => v && typeof v === 'object' && Object.keys(v).length === 1 && Array.isArray(v.bytes) ? new Uint8Array(v.bytes) : v && typeof v === 'object' && Object.keys(v).length === 1 && Array.isArray(v.doubles) ? new Float64Array(v.doubles) : v); }
// UTF-16LE is explicit, reversible, and needs no host encoder or IO.
function toBytes(text) { const bytes = new Uint8Array(text.length * 2); for (let i = 0; i < text.length; i++) { bytes[2 * i] = text.charCodeAt(i) & 255; bytes[2 * i + 1] = text.charCodeAt(i) >>> 8; } return bytes; }
function fromBytes(bytes) { let text = ''; if (bytes.length % 2) throw new TypeError('Invalid save byte count'); for (let i = 0; i < bytes.length; i += 2) text += String.fromCharCode(bytes[i] | bytes[i + 1] << 8); return text; }
/** Create a Phase 1 sim from frozen registries. Optional hooks wire declared lane entry points:
 * aiThink(view,slot,rng), npcTick(api,castle), moraleTick(api,castle), npcKinematics(api).
 * onStage is a deterministic testing hook; hooks are code, not serialized mutable state.
 */
export function createSim({ map, seed = 0, slots, hooks = {} }) {
  if (!isFrozen()) throw new Error('freezeRegistries() is required before createSim');
  const mapDef = typeof map === 'string' ? getMap(map) : map;
  if (!mapDef) throw new TypeError(`Unknown map: ${map}`);
  const slotDefs = (slots ?? mapDef.slots.map((s, id) => ({ id, castleId: s.castle, team: id, color: 0, controller: CONTROLLER.LOCAL, aiLevel: T.ai.levelMin, aiTactic: TACTIC.GENERAL }))).map(s => ({ ...s })).sort((a, b) => a.id - b.id);
  let aiController = hooks.aiThink ? null : createAiController();
  const commandKinds = Object.freeze(Object.values(CMD));
  const streams = createStreams(seed), events = [], blasts = [], destroyed = new Map(), support = new Map(), inputs = {};
  let state = { tick: 0, seed, mapId: mapDef.id, commandKinds, slots: slotDefs, castles: [], rulers: [], npcs: [], weapons: [], projectiles: [], wind: createWind({ rng: streams.get(RNG_STREAM.WIND), ...mapDef.wind }), terrain: generateTerrain(mapDef, seed), outcome: null, pendingCommands: [], nextEntityId: K.MAX_SLOTS };
  for (const slot of slotDefs) {
    const placement = mapDef.slots[slot.id], def = getCastle(slot.castleId ?? placement?.castle);
    if (!placement || !def) throw new TypeError(`Missing castle for slot ${slot.id}`);
    const loaded = loadCastle(def, { origin: placement.origin, id: slot.id, getBlock: getBlockByKey });
    const castle = { ...loaded, id: slot.id, slot: slot.id, facingDeg: placement.facingDeg, gold: mapDef.startGold ?? T.economy.startGold, stats: createStats(), eliminated: false, reason: null, surrendered: false, surrenderTicks: 0, population: 0, initialPopulation: 0, civiliansWorking: 0, morale: T.morale.start, magazines: [], shelter: false,
      pressure:[], palaceDefeatThreshold:T.palace.destroyedBelow, keepCracking:false,
      surrender:{morale:T.morale.start,moraleThreshold:T.rules.surrenderMorale,holdTicks:0,holdRequiredTicks:Math.round(T.rules.surrenderS/K.DT),population:def.population,popThreshold:def.population*T.rules.surrenderPopFrac} };
    state.castles.push(castle);
    state.rulers.push(createRuler(slot.id, slot.controller === CONTROLLER.AI ? loaded.throne ?? loaded.rulerSpawn : loaded.rulerSpawn, slot.id));
    for (const placement of loaded.weapons) {
      const weaponDef = getWeapon(placement.id);
      if (!weaponDef) throw new TypeError(`Unknown weapon: ${placement.id}`);
      state.weapons.push(createWeapon(weaponDef, { id: state.weapons.length, slot: slot.id, pos: placement.pos, facing: placement.facing }));
    }
    support.set(slot.id, createSupport(castle.plot, type => type !== BLOCK.AIR && (type === BLOCK.LADDER || type === BLOCK.DOOR || getBlock(type)?.solid)));
  }
  const emit = (type, payload) => { events.push({ type, payload: snapshot(payload) }); recordNpcEvent(api, type, payload); };
  const castleOf = slot => state.castles.find(c => c.slot === slot);
  // Randomness belongs to a physical castle. Reordering the slot table must not
  // secretly reroll its crew, scatter or AI. Derive ranks from restored state too.
  function castleRng(name) {
    const [kind, owner, ...extra] = name.split(':');
    if (!extra.length && owner !== undefined
      && [RNG_STREAM.AI, RNG_STREAM.SCATTER, RNG_STREAM.NPC].includes(kind)) {
      const castle = castleOf(Number(owner));
      if (castle) {
        const ordered = [...state.castles].sort((a, b) => a.plot.origin.x - b.plot.origin.x
          || a.plot.origin.z - b.plot.origin.z || a.plot.origin.y - b.plot.origin.y || a.slot - b.slot);
        return streams.get(`${kind}:${ordered.indexOf(castle)}`);
      }
    }
    return streams.get(name);
  }
  const ctx = {
    get state() { return state; }, emit, getBlock, getWeapon, castleOf, rng: castleRng,
    spawnProjectile(p) {
      const projectile = { ...p, id: state.nextEntityId++, pos: xyz(p.pos), vel: xyz(p.vel), payload: snapshot(p.payload ?? {}), age: 0 };
      state.projectiles.push(projectile);
      const predicted = predictImpact(projectile);
      if (predicted) for (const ruler of state.rulers) {
        if (ruler.hp <= 0 || ruler.slot === projectile.sourceSlot) continue;
        const p = predicted.pos, r = ruler.pos;
        if ((p.x-r.x)**2 + (p.y-r.y-T.people.height/2)**2 + (p.z-r.z)**2 <= T.threat.rulerRadiusM**2)
          emit(EV.RULER_THREAT, { castle: ruler.slot, fromCastle: projectile.sourceSlot, fromWeapon: projectile.weaponId,
            projectileId: projectile.id, impactPos: [p.x,p.y,p.z], etaTicks: predicted.etaTicks });
      }
      return projectile.id;
    },
    onDestroyed(plot, index, _id, sourceSlot) {
      if (!destroyed.has(plot.id)) destroyed.set(plot.id, []); destroyed.get(plot.id).push(index);
      const castle=castleOf(plot.id);
      if(castle)castle.supportDamageSource={fromCastle:sourceSlot ?? null,fromWeapon:ctx.damageSource?.fromWeapon ?? null,projectileId:ctx.damageSource?.projectileId ?? null};
    },
  };
  function locate(pos) {
    const point = xyz(pos);
    for (const { plot } of state.castles) { const cell = worldToCell(plot, point), index = cellIndex(plot, cell.x, cell.y, cell.z); if (index >= 0) return { plot, cell, index }; }
    return null;
  }
  const api = {
    get tick() { return state.tick; }, get state() { return state; }, rng: ctx.rng, emit, castleOf, windAt: () => windVector(state.wind),
    getBlock(pos) { const found = locate(pos); return found ? { id: found.plot.type[found.index], hp: found.plot.hp[found.index], meta: found.plot.meta[found.index], plot: found.plot.id } : null; },
    damageBlock(pos, dp, sourceSlot) { const found = locate(pos); if (found) damageBlock(ctx, found.plot, found.index, dp, sourceSlot); },
    setBlock(pos, id, meta = 0) { const found = locate(pos), def = getBlock(id); if (found && def) { const before = found.plot.type[found.index]; if (setCell(found.plot, found.cell.x, found.cell.y, found.cell.z, id, def.hp, meta) && before && !id) ctx.onDestroyed(found.plot, found.index); } },
    placeWeapon(slot, defId, cell, facing) {
      const p = castleOf(slot).plot;
      const id = state.weapons.reduce((next, w) => Math.max(next, w.id + 1), 0);
      const w = createWeapon(getWeapon(defId), { id, slot, facing, pos: { x: p.origin.x + cell[0] + 0.5, y: p.origin.y + cell[1], z: p.origin.z + cell[2] + 0.5 } });
      w.facing = facing; state.weapons.push(w);
      emit(EV.WEAPON_PLACED, { weaponId: id, slot, defId }); return id;
    },
    applyBlast(blast) { blasts.push({ ...blast, pos: xyz(blast.pos), damageSource:snapshot(ctx.damageSource) }); },
    damagePeople(blast) { damagePeople(ctx, blast); }, spawnProjectile: ctx.spawnProjectile,
  };
  ctx.api = api;
  hooks = { npcTick, moraleTick, npcKinematics, ...hooks };
  function stage(name) { hooks.onStage?.(name, state.tick); }
  function command(cmd) {
    const castle = castleOf(cmd.slot), ruler = state.rulers.find(r => r.slot === cmd.slot);
    if (!castle || castle.eliminated) return;
    const weapon = state.weapons.find(w => w.id === cmd.weaponId && w.slot === cmd.slot);
    switch (cmd.type) {
      case CMD.MOVE: inputs[cmd.slot] = { ...cmd }; break;
      case CMD.AIM: if (weapon) weapon.aim = { az: cmd.az, range: cmd.range }; break;
      case CMD.FIRE: if (weapon) weapon.fireRequested = true; break;
      case CMD.RESTORE_AIM: if (weapon) weapon.aim = { ...weapon.lastAim }; break;
      case CMD.AUTO_FIRE: if (weapon) weapon.autoFire = Boolean(cmd.on); break;
      case CMD.ORDER_CREW: if (weapon) weapon.crewOrdered = Boolean(cmd.on); break;
      case CMD.MAN_WEAPON:
        if (weapon && ruler.hp > 0 && (weapon.pos.x - ruler.pos.x) * (weapon.pos.x - ruler.pos.x) + (weapon.pos.y - ruler.pos.y) * (weapon.pos.y - ruler.pos.y) + (weapon.pos.z - ruler.pos.z) * (weapon.pos.z - ruler.pos.z) <= T.ruler.interactWeaponM * T.ruler.interactWeaponM) ruler.manning = weapon.id;
        break;
      case CMD.LEAVE_WEAPON: ruler.manning = null; break;
      case CMD.SHELTER: castle.shelter = Boolean(cmd.on); emit(EV.SHELTER_TOGGLED, { slot: cmd.slot, on: castle.shelter }); break;
      case CMD.SURRENDER: castle.surrendered = true; break;
      // Contracts has no rejection event. A stale/unsupported gameplay order is a no-op,
      // like a failed MAN_WEAPON or FIRE; input-shape and tick validation stay strict.
      default: npcCommand(api, cmd); break;
    }
  }
  function terrainHit(a, b) {
    const start = a.y - sampleHeight(state.terrain, a.x, a.z), end = b.y - sampleHeight(state.terrain, b.x, b.z);
    if (start <= 0) return 0;
    if (end > 0) return null;
    // Deterministic bisection refines the sampled terrain hit within this 120 Hz segment.
    let lo = 0, hi = 1;
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) * 0.5, x = a.x + (b.x - a.x) * mid, z = a.z + (b.z - a.z) * mid; if (a.y + (b.y - a.y) * mid > sampleHeight(state.terrain, x, z)) lo = mid; else hi = mid; }
    return hi;
  }
  function collision(projectile, a, b) {
    let best = null;
    const consider = (t, data) => { if (t !== null && (best === null || t < best.t)) best = { ...data, t }; };
    for (const { plot } of state.castles) {
      const hit = raycast(plot, a, b, type => getBlock(type)?.projectileSolid ?? false);
      if (hit) consider(hit.t, { kind: 'block', plot, index: hit.index, cell: hit.cell });
    }
    for (const person of [...state.rulers, ...state.npcs]) if (person.hp > 0 && !projectile.piercedPeople?.includes(person.id)) consider(segmentCapsule(a, b, person), { kind: 'person', person });
    for (const weapon of state.weapons) if (weapon.hp > 0) consider(segmentAabb(a, b, { min: { x: weapon.pos.x - 0.5, y: weapon.pos.y, z: weapon.pos.z - 0.5 }, max: { x: weapon.pos.x + 0.5, y: weapon.pos.y + 1, z: weapon.pos.z + 0.5 } }), { kind: 'weapon', weaponId: weapon.id });
    consider(terrainHit(a, b), { kind: 'terrain' });
    if (mapDef.water && a.y > mapDef.water.y && b.y <= mapDef.water.y) consider((a.y - mapDef.water.y) / (a.y - b.y), { kind: 'water' });
    return best;
  }
  // Freeze public geometry, bodies and launch wind. Prediction consumes no RNG and
  // runs the production integrator/collision functions without resolving damage.
  function predictImpact(projectile) {
    const p = snapshot(projectile), air = windVector(state.wind);
    for (let step = 1; step <= T.sim.projectileMaxLifeS / K.SUBSTEP_DT; step++) {
      const before = { ...p.pos }; integrateProjectile(p, air);
      const hit = collision(p, before, p.pos);
      if (hit) return { pos: { x: before.x+(p.pos.x-before.x)*hit.t, y: before.y+(p.pos.y-before.y)*hit.t, z: before.z+(p.pos.z-before.z)*hit.t }, etaTicks: Math.ceil(step / K.SUBSTEPS) };
      if (p.pos.y < T.sim.projectileMinY || p.pos.x < 0 || p.pos.x > mapDef.size[0] || p.pos.z < 0 || p.pos.z > mapDef.size[1]) break;
    }
    return null;
  }
  function projectilesTick() {
    const impacts = [], alive = [], losses = [];
    for (const projectile of state.projectiles) {
      let hit = null;
      for (let substep = 0; substep < K.SUBSTEPS; substep++) {
        const before = { ...projectile.pos };
        integrateProjectile(projectile, windVector(state.wind)); projectile.age += K.SUBSTEP_DT;
        let start = before, startT = 0;
        // Re-test the unconsumed swept segment after a piercing capsule hit. Impacts
        // retain their own position/payload and the original substep fraction.
        while ((hit = collision(projectile, start, projectile.pos))) {
          const t = startT + (1 - startT) * hit.t;
          const pos = { x: before.x + (projectile.pos.x - before.x) * t, y: before.y + (projectile.pos.y - before.y) * t, z: before.z + (projectile.pos.z - before.z) * t };
          if (piercePerson(projectile, hit)) {
            impacts.push({ projectile: { ...projectile, pos, payload: { ...projectile.payload } }, hit, time: substep + t });
            start = pos; startT = t;
          } else {
            projectile.pos = pos;
            impacts.push({ projectile, hit, time: substep + t }); break;
          }
        }
        if (hit) break;
        const reason = projectile.age >= T.sim.projectileMaxLifeS ? LOST_REASON.EXPIRED
          : projectile.pos.y < T.sim.projectileMinY ? LOST_REASON.BELOW_GROUND
          : projectile.pos.x < 0 || projectile.pos.x > mapDef.size[0] || projectile.pos.z < 0 || projectile.pos.z > mapDef.size[1] ? LOST_REASON.OUT_OF_MAP : null;
        if (reason) {
          hit = { kind: 'void' };
          // Observation only: keep lastImpact as the previous real hit reference.
          // The final integrated position is not a predicted or invented landing.
          losses.push({ slot: projectile.sourceSlot, weaponId: projectile.weaponId,
            projectileId: projectile.id, pos: [projectile.pos.x, projectile.pos.y, projectile.pos.z], reason });
          break;
        }
      }
      if (!hit) alive.push(projectile);
    }
    state.projectiles = alive;
    impacts.sort((a, b) => a.time - b.time || a.projectile.id - b.projectile.id);
    for (const { projectile, hit } of impacts) blasts.push({ projectile, hit, pos: projectile.pos, direct: projectile.payload.direct, splash: projectile.payload.splash, radius: projectile.payload.splashRadius, sourceSlot: projectile.sourceSlot });
    return losses;
  }
  function blastsTick() {
    for (let i = 0; i < blasts.length; i++) {
      const blast = blasts[i], projectile = blast.projectile, hit = blast.hit;
      ctx.damageSource = projectile ? { fromWeapon: projectile.weaponId, projectileId: projectile.id } : blast.damageSource;
      const npcImpact = beginNpcImpact(api, blast);
      if (projectile) {
        if (hit.person) damagePerson(ctx, hit.person, hit.person.hp, projectile.sourceSlot, 'projectile');
        const weapon = state.weapons.find(w => w.id === projectile.weaponId);
        if (weapon) weapon.lastImpact = { ...blast.pos };
        // Keep the collision enum for existing consumers; add the semantic kind
        // before damage can remove the struck block from the public plot.
        const hitKind = hit.plot?.id === projectile.sourceSlot ? 'own-obstruction'
          : hit.kind === 'block' ? hit.plot.type[hit.index] === BLOCK.PALACE ? 'palace' : 'enemy-wall'
          : hit.kind === 'terrain' || hit.kind === 'water' ? 'ground' : hit.kind;
        emit(EV.IMPACT, { slot: projectile.sourceSlot, weaponId: projectile.weaponId, projectileId: projectile.id, pos: [blast.pos.x, blast.pos.y, blast.pos.z], hit: hit.kind, hitKind });
      }
      const def = projectile ? getWeapon(state.weapons.find(w => w.id === projectile.weaponId)?.defId) : null;
      if (def?.onImpact) def.onImpact(api, projectile, hit);
      else {
        const result = applyBlast(ctx, blast), source = castleOf(blast.sourceSlot);
        if (source) { source.stats.damageDp += result.cells.reduce((n, cell) => n + cell.damage, 0); if (projectile && hit.kind !== 'terrain' && hit.kind !== 'water') source.stats.directHits++; }
      }
      endNpcImpact(api, npcImpact);
      ctx.damageSource = null;
    }
    blasts.length = 0;
    for (const castle of state.castles) {
      const work = support.get(castle.id), cells = destroyed.get(castle.id);
      if (cells?.length) queueSupport(work, cells);
      if (work.pending) {
        const result = stepSupport(work);
        if (result.collapsed.length) {
          emit(EV.COLLAPSE, { plot: castle.id, cells: result.collapsed.map(p => [p.x, p.y, p.z]) });
          for (const person of [...state.rulers, ...state.npcs]) {
            const p = worldToCell(castle.plot, person.pos);
            if (result.collapsed.some(c => c.x === p.x && c.z === p.z && c.y > p.y)) {
              ctx.damageSource=castle.supportDamageSource;
              damagePerson(ctx, person, T.people.collapseDmg, castle.supportDamageSource?.fromCastle ?? castle.slot, 'collapse');
              ctx.damageSource=null;
            }
          }
        }
      }
    }
    destroyed.clear();
  }
  function persisted() { return { version: 1, registry: registryHash(), map: mapDef.id, state, ai: aiController?.snapshot() ?? null, streams: streams.snapshot(), inputs, support: [...support].map(([id, work]) => ({ id, seeds: work.seeds, head: work.head, seen: work.seen, active: work.active, version: work.version })) }; }
  const sim = {
    get state() { return snapshot(state); },
    tick(commands = []) {
      if (state.outcome) return;
      for (const cmd of commands) { validateCommand(cmd); if (cmd.tick !== state.tick) throw new RangeError('Command tick must equal current sim tick'); }
      const due = state.pendingCommands.filter(c => c.tick === state.tick);
      const sorted = [...due, ...commands].sort((a, b) => a.slot - b.slot || a.seq - b.seq);
      for (let i = 1; i < sorted.length; i++) if (sorted[i].slot === sorted[i - 1].slot && sorted[i].seq === sorted[i - 1].seq) throw new Error('Duplicate command sequence');
      state.pendingCommands = state.pendingCommands.filter(c => c.tick > state.tick);
      stage('commands'); for (const cmd of sorted) { command(cmd); }
      stage('kinematics'); for (const ruler of state.rulers) if (!castleOf(ruler.slot).eliminated) tickRuler(ctx, ruler, inputs[ruler.slot]); hooks.npcKinematics?.(api);
      stage('ai');
      const think = hooks.aiThink ?? aiController.think;
      for (const slot of state.slots) if (slot.controller === CONTROLLER.AI && !castleOf(slot.id).eliminated && (state.tick + slot.id * T.sim.aiSlotStaggerTicks) % T.sim.aiThinkEveryTicks === 0) {
        const output = think(snapshot(state), { ...slot }, ctx.rng(`${RNG_STREAM.AI}:${slot.id}`)) ?? [];
        for (const cmd of output) { validateCommand(cmd); if (cmd.slot !== slot.id || cmd.tick !== state.tick + 1) throw new RangeError('AI commands must address their slot on the next tick'); state.pendingCommands.push({ ...cmd }); }
      }
      stage('weapons'); tickWeapons(ctx);
      stage('projectiles'); const losses = projectilesTick();
      stage('blasts'); blastsTick();
      // A ballista can pierce a person and leave the map in one tick. Publish
      // its real hit before its terminal loss, so the ending remains the last cue.
      for (const payload of losses) emit(EV.PROJECTILE_LOST, payload);
      stage('jobs'); for (const castle of state.castles) if (!castle.eliminated) hooks.npcTick?.(api, castle);
      stage('economy'); for (const castle of state.castles) if (!castle.eliminated) hooks.moraleTick?.(api, castle); tickEconomy(ctx);
      for (const change of tickWind(state.wind)) emit(EV.WIND_CHANGED, { speed: change.speed, dirDeg: change.direction, prevDirDeg: change.previousDirection });
      stage('rules'); checkRules(ctx); state.tick++;
    },
    drainEvents() { return events.splice(0); },
    hash() { return hash(persisted()); },
    serialize() { return toBytes(encode(persisted())); },
    _restore(saved) {
      state = saved.state;
      if (!hooks.aiThink) aiController = createAiController(saved.ai ?? undefined);
      streams.restore(saved.streams); state.wind.rng = streams.get(RNG_STREAM.WIND);
      for (const [key, value] of Object.entries(saved.inputs)) inputs[key] = value;
      support.clear();
      for (const savedWork of saved.support) { const work = createSupport(castleOf(savedWork.id).plot, type => type !== BLOCK.AIR && (type === BLOCK.LADDER || type === BLOCK.DOOR || getBlock(type)?.solid)); Object.assign(work, savedWork); support.set(savedWork.id, work); }
    },
  };
  hooks.onReady?.(api);
  return sim;
}
/** Restore under the same registry set, including queued AI commands and unfinished support. */
export function restoreSim(blob, { hooks = {} } = {}) {
  const saved = decode(typeof blob === 'string' ? blob : fromBytes(blob));
  if (saved.version !== 1 || saved.registry !== registryHash()) throw new Error('Save registry/version mismatch');
  const sim = createSim({ map: saved.map, seed: saved.state.seed, slots: saved.state.slots, hooks });
  sim._restore(saved);
  return sim;
}

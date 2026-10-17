// src/ai/controller.js - owns scheduled AI command generation and serializable command-source memory.
import { CMD, CMD_FIELDS, EV, CONTROLLER, validateCommand, validateSlot } from '../contracts.js';
import { TUNING as T } from '../tuning.js';
import { aimShot, createAimMemory, geometryAim, observeImpact, recordAim, vector, windChanged } from './aim.js';
import { blockCost, captureBlueprint, planRebuild, planWeaponReplacement, weaponCost } from './build.js';
import { refreshTarget, selectTarget, targetAlive } from './targets.js';
import { publicView, shooterPosition, weaponDefinition } from './view.js';
import { crewPresent } from '../npc/index.js';

/** Clone only serializable command-source records; never retain or mutate SimView references. */
function copy(v) { return Array.isArray(v) ? v.map(copy) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, value]) => [k, copy(value)])) : v; }
const sources = new WeakMap();

/** Staggered tick schedule, also enforced when the sim has already scheduled the call. */
export function isThinkTick(tick, slot) { return (tick + slot * T.sim.aiSlotStaggerTicks) % T.sim.aiThinkEveryTicks === 0; }

/**
 * Binding lane entry point. Each stable injected ai:<slot> RNG identifies its command source.
 * For saves/replays use createAiController and persist its snapshot beside the RNG state.
 * This local lifetime adapter is needed because Slot rejects extra fields and SimView has
 * no AI-memory contract yet. No simulation state is changed by either entry point.
 * @type {import('../contracts.js').AiThink}
 */
export function aiThink(view, slot, rng) {
  if (!sources.has(rng)) sources.set(rng, createAiController());
  return sources.get(rng).think(view, slot, rng);
}

/** Explicit controller lifecycle; caller owns snapshot persistence and controller swaps. */
export function createAiController(saved = { slots: [] }) {
  const memory = copy(saved);
  return { think: (view, slot, rng) => think(view, slot, rng, memory), snapshot: () => copy(memory) };
}

function feedback(view, weapon) {
  const events = (view.events ?? []).filter(e => e.type === EV.IMPACT && e.payload.slot === weapon.slot && e.payload.weaponId === weapon.id);
  const event = events.at(-1);
  if (event) return { pos: event.payload.pos, key: `${event.tick ?? ''}:${vectorKey(event.payload.pos)}` };
  return weapon.lastImpact ? { pos: weapon.lastImpact, key: vectorKey(weapon.lastImpact) } : null;
}
function vectorKey(pos) { const p = vector(pos); return `${p.x}:${p.y}:${p.z}`; }
function isLoaded(weapon, def) { return weapon.loaded ?? ((weapon.reload ?? 0) + 1e-9 >= def.reloadS); }

/** Mutable command-source internals are private; inputs and snapshots remain values. */
function think(view, slot, rng, memory) {
  if (slot.controller !== CONTROLLER.AI || !isThinkTick(view.tick, slot.id)) return [];
  validateSlot(slot);
  const world = publicView(view, slot), castle = world.own;
  if (!castle || castle.eliminated || view.outcome) return [];
  let state = memory.slots.find(s => s.id === slot.id);
  if (state && state.lastTick >= world.tick) return [];
  const ownWeapons = world.weapons.filter(w => w.slot === slot.id && w.hp > 0);
  if (!state) {
    state = { id: slot.id, seq: 0, lastTick: world.tick, lastBuildTick: world.tick, weapons: [], windBias: [],
      windVersion: world.windVersion, blueprint: captureBlueprint(castle, castle.weapons ?? ownWeapons.map(w => {
        const p = vector(w.pos), o = vector(castle.plot.origin ?? [0, 0, 0]);
        return { ...w, at: [Math.floor(p.x - o.x), Math.floor(p.y - o.y), Math.floor(p.z - o.z)] };
      })), incomeGold: 0, spentGold: 0, shelterQuietSince: null, impactKeys: [], enemyImpacts: [] };
    memory.slots.push(state); memory.slots.sort((a, b) => a.id - b.id);
  }
  const elapsed = world.tick - state.lastTick;
  state.incomeGold = Math.max(castle.stats?.income ?? 0, state.incomeGold + elapsed / T.sim.tickHz
    * (T.economy.palaceIncomeS + T.economy.civilianIncomeS * (castle.civiliansWorking ?? 0)));
  state.lastTick = world.tick;
  const commands = [], supports = type => CMD_FIELDS[type] !== undefined && (!view.commandKinds || view.commandKinds.includes(type));
  const emit = (type, fields) => {
    if (!supports(type)) return;
    const command = { type, slot: slot.id, tick: world.tick + 1, seq: state.seq++, ...fields };
    validateCommand(command); commands.push(command);
  };
  const changedWind = state.windVersion !== world.windVersion;
  state.windVersion = world.windVersion;
  let gold = castle.gold;
  for (const weapon of ownWeapons) {
    const def = weaponDefinition(weapon);
    if (!def) continue;
    let wm = state.weapons.find(w => w.id === weapon.id);
    if (!wm) {
      wm = { id: weapon.id, target: null, targetTick: world.tick, aim: null, needsAim: true,
        loadedAt: null, firedWhileLoaded: false, lastShotTick: null, feedbackKey: null, shotTarget: null };
      state.weapons.push(wm);
    }
    const minimumCrew = Math.ceil(def.crewSlots * T.weaponRules.minCrewFrac);
    if (!weapon.crewOrdered || crewPresent(weapon, castle) < minimumCrew) emit(CMD.ORDER_CREW, { weaponId: weapon.id, on: 1 });
    const impact = feedback(view, weapon);
    if (wm.shotTarget && impact && impact.key !== wm.feedbackKey) {
      wm.feedbackKey = impact.key;
      // Invert at the actual impact height, so a shielding voxel is useful feedback.
      const corrected = observeImpact(wm.shotTarget.aim, { shooter: wm.shotTarget.shooter,
          target: wm.shotTarget.pos, impact: impact.pos, level: slot.aiLevel, weapon: def, wind: wm.shotTarget.wind });
      if (wm.aim?.targetId === corrected.targetId) { wm.aim = corrected; wm.needsAim = true; }
      if (slot.aiLevel >= T.ai.windMemoryMinLevel) {
        const bias = { slot: corrected.castleSlot, biasAzDeg: corrected.biasAzDeg, biasDial: corrected.biasDial };
        state.windBias = state.windBias.filter(b => b.slot !== bias.slot); state.windBias.push(bias);
      }
      wm.shotTarget = null;
    }
    if (changedWind && wm.aim) { wm.aim = windChanged(wm.aim); wm.needsAim = true; }
    const current = refreshTarget(view, wm.target);
    if (current && vectorKey(current.pos) !== vectorKey(wm.target.pos)) { wm.target = current; wm.needsAim = true; }
    if ((!targetAlive(view, wm.target) && (wm.target || !wm.targetTried || world.tick - wm.targetTick >= T.ai.targetRetryS * T.sim.tickHz)) || world.tick - wm.targetTick >= T.ai.retargetS * T.sim.tickHz) {
      const target = selectTarget(view, slot, weapon, { ballistic: true });
      wm.targetTried = true;
      if (target?.key !== wm.target?.key) {
        wm.aim = target ? createAimMemory(target.key, target.slot) : null;
        const bias = target && slot.aiLevel >= T.ai.windMemoryMinLevel ? state.windBias.find(b => b.slot === target.slot) : null;
        if (bias) Object.assign(wm.aim, { biasAzDeg: bias.biasAzDeg, biasDial: bias.biasDial });
        wm.needsAim = true;
      }
      wm.target = target; wm.targetTick = world.tick;
    }
    const loaded = isLoaded(weapon, def);
    if (!loaded) { wm.loadedAt = null; wm.firedWhileLoaded = false; }
    else if (wm.loadedAt === null) wm.loadedAt = world.tick;
    if (!wm.target) { if (weapon.autoFire) emit(CMD.AUTO_FIRE, { weaponId: weapon.id, on: 0 }); continue; }
    if (wm.needsAim) {
      wm.shooter = shooterPosition(weapon, wm.target.pos);
      if (!weapon.muzzle) wm.shooter.y = vector(weapon.pos).y + T.weaponRules.wallFootprint[2] / 2;
      wm.solution = geometryAim(wm.shooter, wm.target.pos, def, world.wind, weapon.rangeTable);
      wm.commandAim = aimShot(wm.solution, slot.aiLevel, rng, wm.aim);
      emit(CMD.AIM, { weaponId: weapon.id, ...wm.commandAim }); wm.needsAim = false;
    }
    const delay = (T.ai.levelMax + 1 - slot.aiLevel) * T.ai.fireDelayPerLevelS * T.sim.tickHz;
    const crewed = weapon.rulerManning || crewPresent(weapon, castle) >= minimumCrew;
    if (supports(CMD.FIRE) && supports(CMD.AIM) && loaded && crewed && world.tick - wm.loadedAt >= delay && gold >= def.fireCost && wm.solution.reachable) {
      emit(CMD.FIRE, { weaponId: weapon.id });
      // Retry each think until reload confirms a shot. Continuous auto-fire would
      // bypass the level's loaded delay and aim feedback on subsequent reloads.
      wm.firedWhileLoaded = true; wm.lastShotTick = world.tick + 1; wm.feedbackKey = impact?.key ?? null;
      wm.shotTarget = { aim: recordAim(wm.aim, wm.solution, wm.commandAim), shooter: copy(wm.shooter), pos: copy(wm.target.pos), occluded: wm.target.occluded ?? false, wind: copy(world.wind) };
      gold -= def.fireCost;
    } else if (weapon.autoFire) emit(CMD.AUTO_FIRE, { weaponId: weapon.id, on: 0 });
  }
  if (world.tick - state.lastBuildTick >= T.ai.buildEveryS * T.sim.tickHz) {
    state.lastBuildTick = world.tick;
    if (supports(CMD.DESIGNATE)) for (const plan of planRebuild({ ...castle, gold }, state.blueprint, slot.aiTactic, state)) {
      emit(plan.type, Object.fromEntries(Object.entries(plan).filter(([key]) => key !== 'type')));
      const price = blockCost(plan.block);
      gold -= price; state.spentGold += price;
    }
    if (supports(CMD.DESIGNATE_WEAPON)) for (const plan of planWeaponReplacement({ ...castle, gold }, state.blueprint, slot.aiTactic, ownWeapons,
      { weaponCap: view.weaponCap ?? T.world.weaponCapDefault, pending: castle.weaponDesignations ?? [] })) {
      emit(plan.type, { weapon: plan.weapon, cell: plan.cell, facing: plan.facing }); gold -= weaponCost(plan.weapon);
    }
  }
  shelter(view, slot, castle, state, emit);
  return commands;
}

/** Only own morale and timestamped public enemy impacts influence defensive shelter orders. */
function shelter(view, slot, castle, state, emit) {
  for (const event of view.events ?? []) {
    if (event.type !== EV.IMPACT || event.payload.slot === slot.id || !Number.isInteger(event.tick)) continue;
    const key = `${event.tick}:${event.payload.slot}:${event.payload.weaponId}:${vectorKey(event.payload.pos)}`;
    if (state.impactKeys.includes(key)) continue;
    const p = vector(event.payload.pos), o = vector(castle.plot.origin ?? [0, 0, 0]);
    if (p.x >= o.x && p.x < o.x + (castle.plot.width ?? T.world.plotW) && p.z >= o.z && p.z < o.z + (castle.plot.depth ?? T.world.plotD)) {
      state.impactKeys.push(key); state.enemyImpacts.push(event.tick);
    }
  }
  state.enemyImpacts = state.enemyImpacts.filter(t => t >= view.tick - T.ai.shelterWindowS * T.sim.tickHz);
  const low = (typeof castle.morale === 'number' ? castle.morale : castle.morale?.value ?? T.morale.start) < T.ai.shelterBelow;
  const underFire = state.enemyImpacts.length >= T.ai.shelterImpacts;
  if (low && underFire) { state.shelterQuietSince = null; if (!castle.shelter) emit(CMD.SHELTER, { on: 1 }); }
  else if (!low && !underFire) {
    if (state.shelterQuietSince === null) state.shelterQuietSince = view.tick;
    if (castle.shelter && view.tick - state.shelterQuietSince >= T.ai.shelterOffS * T.sim.tickHz) emit(CMD.SHELTER, { on: 0 });
  } else state.shelterQuietSince = null;
}

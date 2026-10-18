// src/ai/controller.js - owns scheduled AI command generation and serializable command-source memory.
import { CMD, CMD_FIELDS, EV, CONTROLLER, BLOCK, getMap, validateCommand, validateSlot } from '../contracts.js';
import { rulerPathMove } from './ruler-route.js';
import { findPathToAny } from '../npc/path.js';
import { TUNING as T } from '../tuning.js';
import { aimShot, createAimMemory, geometryAim, observeImpact, recordAim, vector, windChanged } from './aim.js';
import { blockCost, captureBlueprint, planRebuild, planWeaponReplacement, weaponCost, withRecoveryMounts } from './build.js';
import { refreshTarget, selectTarget, targetAlive } from './targets.js';
import { publicView, shooterPosition, visibleTarget, weaponDefinition } from './view.js';
import { shelterCells } from '../npc/brain.js';
import { missingWeaponCost, blocksWeaponMuzzle, operatorCell } from '../npc/model.js';
import { crewPresent } from '../npc/index.js';

/** Clone only serializable command-source records; never retain or mutate SimView references. */
function copy(v) { return Array.isArray(v) ? v.map(copy) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, value]) => [k, copy(value)])) : v; }
const sources = new WeakMap();

/** Shared tick schedule, also enforced when the sim has already scheduled the call. */
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
    const enemy = world.castles.find(c => c.slot !== slot.id && !c.eliminated && c.plot);
    if (enemy) state.blueprint = withRecoveryMounts(castle, state.blueprint, vector(enemy.plot.origin).x - vector(castle.plot.origin).x, view);
    memory.slots.push(state); memory.slots.sort((a, b) => a.id - b.id);
  }
  const elapsed = world.tick - state.lastTick;
  state.incomeGold = Math.max(castle.stats?.income ?? 0, state.incomeGold + elapsed / T.sim.tickHz
    * (T.economy.palaceIncomeS + T.economy.civilianIncomeS * (castle.civiliansWorking ?? 0)));
  state.lastTick = world.tick;
  state.lastCastleShotTick ??= world.tick;state.lastCastleShotCount ??= castle.stats?.shots ?? 0;
  if(castle.stats && castle.stats.shots!==state.lastCastleShotCount){state.lastCastleShotTick=world.tick;state.lastCastleShotCount=castle.stats.shots;}
  const commands = [], supports = type => CMD_FIELDS[type] !== undefined && (!view.commandKinds || view.commandKinds.includes(type));
  const emit = (type, fields) => {
    if (!supports(type)) return;
    const command = { type, slot: slot.id, tick: world.tick + 1, seq: state.seq++, ...fields };
    validateCommand(command); commands.push(command);
  };
  const changedWind = state.windVersion !== world.windVersion;
  state.windVersion = world.windVersion;
  if(changedWind)for(const bias of state.windBias)bias.observations=Math.max(0,(bias.observations ?? 0)-T.ai.windResetSteps);
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
      const ownPlot=castle.plot,origin=vector(ownPlot.origin),point=vector(impact.pos),goal=vector(wm.shotTarget.pos);
      const inside=p=>p.x>=origin.x&&p.x<origin.x+(ownPlot.width ?? T.world.plotW)&&p.z>=origin.z&&p.z<origin.z+(ownPlot.depth ?? T.world.plotD);
      const obstruction=inside(point)&&!inside(goal);
      if(obstruction){if(wm.aim){wm.aim.biasAzDeg=0;wm.aim.biasDial=0;wm.needsAim=true;}
        state.windBias=state.windBias.filter(b=>b.slot!==wm.shotTarget.aim.castleSlot||b.defId!==def.id);
      }else{
      // Invert at the actual impact height, so a shielding voxel is useful feedback.
      const corrected = observeImpact(wm.shotTarget.aim, { shooter: wm.shotTarget.shooter,
          target: wm.shotTarget.feedbackPos ?? wm.shotTarget.pos, impact: impact.pos, level: slot.aiLevel, weapon: def, wind: wm.shotTarget.wind });
      if (wm.aim?.targetId === corrected.targetId) { wm.aim = corrected; wm.needsAim = true; }
      {
        const bias = { slot: corrected.castleSlot, defId: def.id, kind: wm.shotTarget.kind ?? wm.target?.kind, observations: corrected.observations, biasAzDeg: corrected.biasAzDeg, biasDial: corrected.biasDial };
        state.windBias = state.windBias.filter(b => b.slot !== bias.slot || b.defId !== bias.defId || b.kind !== bias.kind); state.windBias.push(bias);
      }
      }
      wm.shotTarget = null;
    }
    if (changedWind && wm.aim) { wm.aim = windChanged(wm.aim); wm.needsAim = true; }
    const breach = world.tick >= T.ai.breachAfterS * T.sim.tickHz;
    wm.exposures ??= [];
    const visible = (view.rulers ?? []).filter(r=>r.hp>0 && world.castles.some(c=>c.slot===r.slot&&!c.eliminated)
      && (view.slots ?? []).find(s=>s.id===r.slot)?.team!==slot.team).filter(r=>{
        const target={slot:r.slot,pos:{...vector(r.pos),y:vector(r.pos).y+T.people.height/2}};
        return visibleTarget(view,shooterPosition(weapon,target.pos),target);
      });
    wm.exposures=visible.map(r=>wm.exposures.find(e=>e.slot===r.slot) ?? {slot:r.slot,since:world.tick});
    const rulerSlots=wm.exposures.filter(e=>world.tick-e.since>=T.ai.rulerExposureS*T.sim.tickHz).map(e=>e.slot);
    const opportunity=rulerSlots.length && wm.target?.kind!=='ruler';
    const lostRuler=wm.target?.kind==='ruler'&&!rulerSlots.includes(wm.target.slot);
    const forceBreach = breach && wm.target && !['palace', 'shieldWall','ruler'].includes(wm.target.kind);
    const staleLane = world.tick - (wm.lastShotTick ?? wm.targetTick) >= T.ai.maxFireSilenceS * T.sim.tickHz;
    const current = refreshTarget(view, wm.target);
    if (current && vectorKey(current.pos) !== vectorKey(wm.target.pos)) { wm.target = current; wm.needsAim = true; }
    if (opportunity || lostRuler || forceBreach || staleLane || (!targetAlive(view, wm.target) && (wm.target || !wm.targetTried || world.tick - wm.targetTick >= T.ai.targetRetryS * T.sim.tickHz)) || world.tick - wm.targetTick >= T.ai.retargetS * T.sim.tickHz) {
      const target = selectTarget(view, slot, weapon, { ballistic: true, breach, rulerSlots });
      wm.targetTried = true;
      if (target?.key !== wm.target?.key) {
        const confidence=target?Math.max(wm.aim?.castleSlot===target.slot?wm.aim.observations:0,
          ...state.windBias.filter(b=>b.slot===target.slot&&b.defId===def.id).map(b=>b.observations ?? 0)):0;
        wm.aim = target ? createAimMemory(target.key, target.slot) : null;
        if(wm.aim)wm.aim.observations=Math.min(confidence,T.ai.transferConfidenceMax);
        const bias = target && slot.aiLevel >= T.ai.windMemoryMinLevel ? state.windBias.find(b => b.slot === target.slot && b.defId === def.id && b.kind === target.kind) : null;
        if (bias) Object.assign(wm.aim, { biasAzDeg: bias.biasAzDeg, biasDial: bias.biasDial });
        wm.needsAim = true;
      }
      if (target && wm.target && vectorKey(target.pos) !== vectorKey(wm.target.pos)) wm.needsAim = true;
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
    if (supports(CMD.FIRE) && supports(CMD.AIM) && loaded && crewed && (weapon.ammo ?? def.ammoLoads)>=def.ammoLoads && world.tick - wm.loadedAt >= delay && gold >= def.fireCost && wm.solution.reachable
      && ![...(view.npcs ?? []),...(view.rulers ?? [])].some(p=>(p.slot ?? p.castle)===slot.id&&blocksWeaponMuzzle({...weapon,aim:wm.commandAim},p))) {
      emit(CMD.FIRE, { weaponId: weapon.id });
      // Retry each think until reload confirms a shot. Continuous auto-fire would
      // bypass the level's loaded delay and aim feedback on subsequent reloads.
      wm.firedWhileLoaded = true; wm.lastShotTick = world.tick + 1; wm.feedbackKey = impact?.key ?? null;
      wm.shotTarget = { kind:wm.target.kind, aim: recordAim(wm.aim, wm.solution, wm.commandAim), shooter: copy(wm.shooter), pos: copy(wm.target.pos), feedbackPos: copy(wm.target.feedbackPos), occluded: wm.target.occluded ?? false, wind: copy(world.wind) };
      gold -= def.fireCost;
    } else if (weapon.autoFire) emit(CMD.AUTO_FIRE, { weaponId: weapon.id, on: 0 });
  }
  if (world.tick - state.lastBuildTick >= T.ai.buildEveryS * T.sim.tickHz) {
    state.lastBuildTick = world.tick;
    const usable = ownWeapons.filter(w => state.weapons.find(m => m.id===w.id)?.solution?.reachable
      && state.weapons.find(m => m.id===w.id)?.target && (w.ammo ?? 1)>0
      && crewPresent(w,castle)>=Math.ceil(weaponDefinition(w).crewSlots*T.weaponRules.minCrewFrac));
    const shotReserve = usable.length ? Math.min(...usable.map(w=>weaponDefinition(w).fireCost)) : 0;
    state.unusableIds=(state.unusableIds ?? []).filter(id=>{const w=ownWeapons.find(w=>w.id===id),m=state.weapons.find(m=>m.id===id);return w && (w.ammo===0||crewPresent(w,castle)<Math.ceil(weaponDefinition(w).crewSlots*T.weaponRules.minCrewFrac)||!m?.target||!m.solution?.reachable);});
    if(world.tick-state.lastCastleShotTick>=T.ai.maxFireSilenceS*T.sim.tickHz)for(const w of ownWeapons)if(!state.unusableIds.includes(w.id))state.unusableIds.push(w.id);
    const replacementNeed = missingWeaponCost(state.blueprint.weapons,ownWeapons.filter(w=>!state.unusableIds.includes(w.id)));
    const recovering = replacementNeed>0 || ownWeapons.some(w => w.ammo === 0
      || w.crewOrdered && crewPresent(w,castle) < Math.ceil(weaponDefinition(w).crewSlots*T.weaponRules.minCrewFrac));
    let pending = castle.npcDesignations ?? castle.weaponDesignations ?? [];
    if (recovering && supports(CMD.CANCEL) && pending.length>T.world.maxOpenDesignations-T.ai.buildPerThink) {
      const stale=pending.filter(d=>!d.weapon&&d.block===BLOCK.ROOF&&!(castle.jobs ?? []).some(j=>j.target.cell?.every((n,i)=>n===d.cell[i])&&j.claimedBy.length));
      for(const d of stale.slice(0,T.ai.buildPerThink)) {
        emit(CMD.CANCEL,{cell:[...d.cell]});gold=Math.min(T.economy.goldCap,gold+(d.reserved ?? 0));
        state.spentGold=Math.max(0,state.spentGold-(d.reserved ?? 0));pending=pending.filter(p=>p!==d);
      }
    }
    const planned = [];
    if (supports(CMD.DESIGNATE_WEAPON)) for (const plan of planWeaponReplacement({ ...castle, gold, npcDesignations:pending }, state.blueprint, slot.aiTactic, ownWeapons,
      { shotReserve, weaponCap: view.weaponCap ?? getMap(view.mapId)?.weaponCap ?? T.world.weaponCapDefault, view, unusableIds:state.unusableIds, pending: pending.filter(d => d.weapon), acceptSpot:(spot,defId)=>Boolean(selectTarget(view,slot,{id:-1,slot:slot.id,defId,hp:weaponDefinition({defId}).hp,pos:{x:vector(castle.plot.origin).x+spot[0]+.5,y:vector(castle.plot.origin).y+spot[1],z:vector(castle.plot.origin).z+spot[2]+.5}}, {ballistic:true,breach:true,rulerSlots:[]})) })) {
      emit(plan.type, { weapon: plan.weapon, cell: plan.cell, facing: plan.facing }); gold -= weaponCost(plan.weapon); planned.push(plan);
    }

    const recoveryReserve = Math.max(replacementNeed,ownWeapons.some(w => w.hp <= weaponDefinition(w).hp * T.ai.recoveryGunHpFrac) ? Math.min(...state.blueprint.weapons.map(w => weaponCost(w.defId))) : 0);
    if (supports(CMD.DESIGNATE)) for (const plan of planRebuild({ ...castle, gold: recovering ? gold : Math.max(0, gold - recoveryReserve), npcDesignations: [...pending, ...planned] }, state.blueprint, slot.aiTactic, state, view, {shotReserve})) {
      emit(plan.type, Object.fromEntries(Object.entries(plan).filter(([key]) => key !== 'type')));
      const price = blockCost(plan.block);
      gold -= price; state.spentGold += price;
      planned.push(plan);
    }
  }
  retreat(view, slot, castle, state, emit, supports);
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

/** A ruler exposed to shell impacts walks to an existing shelter, using the same
 * movement/collision rules as the player. No teleports, healing or invulnerability. */
function retreat(view, slot, castle, state, emit, supports) {
  if (!supports(CMD.MOVE) || !castle.plot) return;
  const ruler=(view.rulers ?? []).find(r=>r.slot===slot.id && r.hp>0);
  if (!ruler) return;
  const p=castle.plot, o=vector(p.origin), pos=vector(ruler.pos);
  const threat=(castle.enemyImpacts ?? []).some(e=>view.tick-e.tick<=T.ai.rulerDangerWindowS*T.sim.tickHz
    && (e.pos.x-pos.x)**2+(e.pos.y-pos.y)**2+(e.pos.z-pos.z)**2<T.ai.rulerDangerM**2);
  const abandoned=state.leadershipActive!==undefined && (ruler.manning!==state.leadershipActive
    || !(view.weapons ?? []).some(w=>w.id===state.leadershipActive&&w.hp>0));
  if (abandoned || threat && (state.rulerDuty && view.tick-state.rulerDuty.startedTick>T.ai.rulerLeadershipCommitS*T.sim.tickHz || state.leadershipActive!==undefined)) {
    state.rulerReturnPending=true;
    state.rulerDuty=null;state.rulerPath=null;delete state.leadershipActive;
    if(ruler.manning!==null)emit(CMD.LEAVE_WEAPON,{});
  }
  // Leadership already gives nearby workers a real reload/work bonus. A depleted,
  // shaken castle may commit its ruler to the front crew once, accepting visible
  // exposure in exchange for that shared human/NPC benefit.
  if (!state.leadershipDone && !state.rulerPath && castle.morale<T.ai.rulerLeadershipBelow
    && castle.population<castle.initialPopulation*T.ai.rulerLeadershipPopFrac) {
    const enemy=worldEnemy(view,slot,castle);
    const guns=(view.weapons ?? []).filter(w=>w.slot===slot.id&&w.hp>0&&w.crewOrdered);
    if(enemy)guns.sort((a,b)=>(a.pos.x-enemy.plot.origin.x)**2+(a.pos.z-enemy.plot.origin.z)**2
      -((b.pos.x-enemy.plot.origin.x)**2+(b.pos.z-enemy.plot.origin.z)**2)||a.id-b.id);
    const start=[Math.floor(pos.x-o.x),Math.floor(pos.y-o.y),Math.floor(pos.z-o.z)];
    for(const gun of guns) {
      const path=findPathToAny(p,start,[operatorCell(gun,castle)],{clamber:false});
      if(path?.length>1){state.rulerPath=path.slice(1);state.rulerDuty={weaponId:gun.id,startedTick:view.tick};state.leadershipDone=true;break;}
    }
  }
  if (!state.rulerPath && (threat || state.rulerReturnPending) && (state.rulerReturnPending || view.tick-(state.lastRulerRetreatTick ?? -T.ai.rulerRetreatCooldownS*T.sim.tickHz)>=T.ai.rulerRetreatCooldownS*T.sim.tickHz)) {
    // Shelter is a destination, not a floor restriction: stairs and ladders
    // in findPathToAny decide whether a lower room is physically reachable.
    const goals=shelterCells(castle).map(c=>[...c]);
    const impacts=castle.enemyImpacts ?? [];
    const safety=c=>Math.min(...impacts.map(e=>(o.x+c[0]+.5-e.pos.x)**2+(o.z+c[2]+.5-e.pos.z)**2));
    const authored=c=>(castle.shelters ?? []).some(b=>c.every((v,i)=>v>=b[i]&&v<=b[i+3]));
    goals.sort((a,b)=>Number(authored(b))-Number(authored(a))||safety(b)-safety(a)||a[2]-b[2]||a[0]-b[0]);
    const start=[Math.floor(pos.x-o.x),Math.floor(pos.y-o.y),Math.floor(pos.z-o.z)];
    for(const goal of goals){const path=findPathToAny(p,start,[goal],{clamber:false});if(path){state.rulerPath=path.slice(1);break;}}
  }
  if (!state.rulerPath) return;
  const move=rulerPathMove(p,ruler,state.rulerPath);
  if(state.rulerPath.length){emit(CMD.MOVE,move);return;}
  state.rulerPath=null;state.lastRulerRetreatTick=view.tick;delete state.rulerReturnPending;
  emit(CMD.MOVE,{fwd:0,strafe:0,yaw:ruler.yaw ?? 0,pitch:0,jump:0,sprint:0});
  if(state.rulerDuty){emit(CMD.MAN_WEAPON,{weaponId:state.rulerDuty.weaponId});state.leadershipActive=state.rulerDuty.weaponId;state.rulerDuty=null;}
}

function worldEnemy(view,slot,castle) {
  const from=vector(castle.plot.origin);
  return (view.castles ?? []).filter(c=>!c.eliminated&&c.plot&&(view.slots ?? []).find(s=>s.id===c.slot)?.team!==slot.team)
    .sort((a,b)=>(a.plot.origin.x-from.x)**2+(a.plot.origin.z-from.z)**2-((b.plot.origin.x-from.x)**2+(b.plot.origin.z-from.z)**2)||a.slot-b.slot)[0];
}

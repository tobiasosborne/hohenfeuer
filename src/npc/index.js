// src/npc/index.js - owns lane entry exports and the ruler-order adapter.
import { CMD, JOB, META, EV, BLOCK } from '../contracts.js';
import { TUNING as T } from '../tuning.js';
import { indexOf, blockDef } from './model.js';
import { addJob, finishJob } from './jobs.js';
export { npcTick } from './brain.js';
export { moraleTick, recordNpcEvent, recordProjectileResult, beginNpcImpact, endNpcImpact, queueMoraleInput } from './morale.js';
export { npcKinematics } from './kinematics.js';
export { crewPresent, reloadMultiplier, canFire } from './crew.js';

/** Read-only designation eligibility shared by command producers and the dispatcher. */
export function canDesignate(castle, command) {
  if (!castle || castle.eliminated || !command.cell) return false;
  const i = indexOf(castle.plot, command.cell), build = command.type === CMD.DESIGNATE;
  if (i < 0 || command.cell[1] < T.world.buildMinY || command.cell[1] > T.world.buildMaxY
    || !build && command.type !== CMD.DEMOLISH) return false;
  if ((castle.npcDesignations?.length ?? 0) >= T.world.maxOpenDesignations || castle.plot.meta[i] & META.DESIGNATED_BIT) return false;
  const def = blockDef(command.block);
  return build ? Boolean(def && def.cost !== null && castle.plot.type[i] === BLOCK.AIR && castle.gold >= def.cost)
    : castle.plot.type[i] !== BLOCK.AIR;
}

/** Commands already handled by sim.js need no adapter; later designation/priority commands do. */
export function npcCommand(api, command) {
  const castle = api.castleOf(command.slot);
  if (!castle || castle.eliminated) return false;
  const weapon = api.state.weapons.find(w => w.id === command.weaponId && w.slot === command.slot);
  if (command.type === CMD.ORDER_CREW) { if (weapon) weapon.crewOrdered = Boolean(command.on); return Boolean(weapon); }
  if (command.type === CMD.SHELTER) { castle.shelter = Boolean(command.on); api.emit(EV.SHELTER_TOGGLED, { slot: castle.slot, on: castle.shelter }); return true; }
  if (command.type === CMD.AMMO_PRIORITY) { if (weapon) { weapon.ammoPriority = true; addJob(api, castle, JOB.HAUL_AMMO, { weaponId: weapon.id }, { priority: 3 }); } return Boolean(weapon); }
  const i = command.cell ? indexOf(castle.plot, command.cell) : -1;
  if (i < 0 || command.cell[1] < T.world.buildMinY || command.cell[1] > T.world.buildMaxY) return false;
  if (command.type === CMD.REPAIR_PRIORITY) { addJob(api, castle, JOB.REPAIR, { cell: [...command.cell] }, { priority: 3 }); return true; }
  if (command.type === CMD.CANCEL) {
    const d = castle.npcDesignations?.find(d => indexOf(castle.plot, d.cell) === i);
    if (!d) return false;
    castle.gold = Math.min(T.economy.goldCap, castle.gold + (d.reserved ?? 0));
    castle.npcDesignations = castle.npcDesignations.filter(entry => indexOf(castle.plot, entry.cell) !== i);
    castle.plot.meta[i] &= ~META.DESIGNATED_BIT;
    for (const job of [...(castle.jobs ?? [])]) if (job.target.cell && indexOf(castle.plot, job.target.cell) === i && (job.kind === JOB.BUILD || job.kind === JOB.DEMOLISH)) finishJob(api, castle, job);
    api.emit(EV.DESIGNATION_CANCELLED, { slot: castle.slot, cell: command.cell }); return true;
  }
  if (command.type !== CMD.DESIGNATE && command.type !== CMD.DEMOLISH) return false;
  if (!canDesignate(castle, command)) return false;
  const def = blockDef(command.block), build = command.type === CMD.DESIGNATE;
  const reserved = build ? def.cost : 0;
  castle.gold -= reserved;
  castle.npcDesignations ??= [];
  castle.npcDesignations.push({ cell: [...command.cell], block: build ? command.block : castle.plot.type[i], facing: command.facing ?? 0,
    kind: build ? JOB.BUILD : JOB.DEMOLISH, reserved });
  castle.plot.meta[i] = (castle.plot.meta[i] & ~META.FACING_MASK) | (command.facing ?? 0) | META.DESIGNATED_BIT;
  api.emit(EV.DESIGNATION_ADDED, { slot: castle.slot, cell: command.cell, block: command.block }); return true;
}

// src/npc/index.js - owns lane entry exports and the ruler-order adapter.
import { CMD, JOB, META, EV, BLOCK, getWeapon } from '../contracts.js';
import { TUNING as T } from '../tuning.js';
import { indexOf, blockDef } from './model.js';
import { addJob, finishJob } from './jobs.js';
import { canDesignate } from './designations.js';
import { spend, refund } from '../sim/economy.js';
export { canDesignate, designationReason, supportedCell, cellHasPerson, cellHasWeapon } from './designations.js';
export { npcTick } from './brain.js';
export { moraleTick, recordNpcEvent, recordProjectileResult, beginNpcImpact, endNpcImpact, queueMoraleInput } from './morale.js';
export { npcKinematics } from './kinematics.js';
export { crewPresent, reloadMultiplier, canFire } from './crew.js';

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
    refund(castle, d.reserved ?? 0);
    castle.npcDesignations = castle.npcDesignations.filter(entry => indexOf(castle.plot, entry.cell) !== i);
    castle.plot.meta[i] = d.previousMeta ?? (castle.plot.meta[i] & ~META.DESIGNATED_BIT);
    for (const job of [...(castle.jobs ?? [])]) if (job.target.cell && indexOf(castle.plot, job.target.cell) === i && (job.kind === JOB.BUILD || job.kind === JOB.DEMOLISH)) finishJob(api, castle, job);
    api.emit(EV.DESIGNATION_CANCELLED, { slot: castle.slot, cell: command.cell }); return true;
  }
  if (![CMD.DESIGNATE, CMD.DESIGNATE_WEAPON, CMD.DEMOLISH].includes(command.type)) return false;
  if (!canDesignate(castle, command, api.state)) return false;
  const placingWeapon = command.type === CMD.DESIGNATE_WEAPON, build = command.type !== CMD.DEMOLISH;
  const def = placingWeapon ? getWeapon(command.weapon) ?? T.weapons[command.weapon] : blockDef(command.block);
  const reserved = build ? def.cost : 0;
  if (!spend(castle, reserved)) return false;
  const facing = build ? command.facing ?? 0 : castle.plot.meta[i] & META.FACING_MASK;
  castle.npcDesignations ??= [];
  castle.npcDesignations.push({ cell: [...command.cell], block: placingWeapon ? BLOCK.AIR : build ? command.block : castle.plot.type[i], facing,
    kind: build ? JOB.BUILD : JOB.DEMOLISH, reserved, previousMeta: castle.plot.meta[i], ...(placingWeapon ? { weapon: command.weapon } : {}) });
  castle.plot.meta[i] = (castle.plot.meta[i] & ~META.FACING_MASK) | facing | META.DESIGNATED_BIT;
  api.emit(EV.DESIGNATION_ADDED, { slot: castle.slot, cell: command.cell, block: command.block, weapon: command.weapon, kind: build ? JOB.BUILD : JOB.DEMOLISH, reserved }); return true;
}

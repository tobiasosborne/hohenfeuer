// src/ai/slots.js - owns validated controller metadata for map slots and reserved Phase 4 interfaces.
import { CONTROLLER, TACTIC, K, validateSlot } from '../contracts.js';
import { TUNING as T } from '../tuning.js';

/**
 * Local settings adapter: {slots:[Partial<Slot>], aiLevel?, aiTactic?, controller?}.
 * Color defaults to zero until the menu supplies its palette; no palette tuning is defined.
 * @param {import('../contracts.js').MapDef} mapDef @param {object} settings
 * @returns {import('../contracts.js').Slot[]}
 */
export function createSlotTable(mapDef, settings = {}) {
  if (!Array.isArray(mapDef.slots) || mapDef.slots.length < 1 || mapDef.slots.length > K.MAX_SLOTS) throw new RangeError('Map requires 1..4 slots');
  return mapDef.slots.map((entry, id) => {
    const override = settings.slots?.[id] ?? {};
    const slot = { id, castleId: entry.castle, team: override.team ?? id, color: override.color ?? 0,
      controller: override.controller ?? settings.controller ?? CONTROLLER.AI,
      aiLevel: override.aiLevel ?? settings.aiLevel ?? Math.floor((T.ai.levelMin + T.ai.levelMax) / 2),
      aiTactic: override.aiTactic ?? settings.aiTactic ?? TACTIC.GENERAL };
    validateSlot(slot);
    return slot;
  });
}

/** Controller swap returns metadata; the caller keeps the same simulation and AI memory. */
export function swapController(table, id, controller) {
  if (!table.some(s => s.id === id)) throw new RangeError(`Unknown slot ${id}`);
  return table.map(slot => {
    const copy = { ...slot, ...(slot.id === id ? { controller } : {}) };
    validateSlot(copy);
    return copy;
  });
}

/** Explicitly reserved for the running-time 30-second local-human turn timer (Phase 4). */
export function createHotSeatTimer() { const error = new Error('Phase 4 hot-seat timer'); error.name = 'NotImplemented'; throw error; }
/** Explicitly reserved for delayed input, registry handshake and hash comparison (Phase 4). */
export function createLockstepHarness() { const error = new Error('Phase 4 lockstep harness'); error.name = 'NotImplemented'; throw error; }

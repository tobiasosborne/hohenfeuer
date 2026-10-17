// src/sim/economy.js - owns castle gold, atomic spending and magazine restock timers.
import { K } from '../contracts.js';
import { TUNING as T } from '../tuning.js';
/** Debit only when the full positive amount is affordable. */
export function spend(castle, amount) { if (!Number.isFinite(amount) || amount < 0 || castle.gold < amount) return false; castle.gold -= amount; return true; }
/** Refund reserved gold up to the normal castle cap. */
export function refund(castle, amount) { castle.gold = Math.min(T.economy.goldCap, castle.gold + Math.max(0, amount)); }
/** Phase 1 income; magazine bookkeeping is ready for later hauled-load consumption. */
export function tickEconomy(ctx, dt = K.DT) {
  for (const castle of ctx.state.castles) {
    if (castle.eliminated) continue;
    castle.gold = Math.min(T.economy.goldCap, castle.gold + (T.economy.palaceIncomeS + T.economy.civilianIncomeS * (castle.civiliansWorking ?? 0)) * dt);
    for (const magazine of castle.magazines ?? []) {
      magazine.restock = (magazine.restock ?? 0) + dt;
      while (magazine.restock >= T.magazine.restockS) { magazine.restock -= T.magazine.restockS; magazine.stock = Math.min(T.magazine.capacityLoads, magazine.stock + 1); }
    }
  }
}

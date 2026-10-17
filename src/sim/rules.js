// src/sim/rules.js - owns ordered castle eliminations, winner teams and battle statistics.
import { BLOCK, EV, ELIM, K } from '../contracts.js';
import { TUNING as T } from '../tuning.js';
/** Initial per-castle counters; accuracy is derived on demand. */
export function createStats() { return { shots: 0, directHits: 0, damageDp: 0, damageGold: 0, losses: 0, ammoCosts: 0, income: 0, eliminatedTick: null }; }
/** Current palace fraction from original cell indices, including blocks replaced with air. */
export function palaceIntegrity(castle) { return castle.initialPalaceHp > 0 ? castle.palaceCells.reduce((hp, i) => hp + (castle.plot.type[i] === BLOCK.PALACE ? castle.plot.hp[i] : 0), 0) / castle.initialPalaceHp : 1; }
/** Late damage makes an already cracked keep untenable; never removes palace hp. */
export function palaceDefeatThreshold(tick) {
  const seconds = tick / T.sim.tickHz;
  const progress = Math.max(0, Math.min(1, (seconds - T.palace.crackingStartS) / (T.palace.crackingEndS - T.palace.crackingStartS)));
  return T.palace.destroyedBelow + progress * (T.palace.crackingDestroyedBelow - T.palace.destroyedBelow);
}
/** Evaluate all eliminations before deciding the match, so simultaneous destruction is a draw. */
export function checkRules(ctx) {
  const { state } = ctx;
  if (state.outcome) return state.outcome;
  for (const castle of state.castles) {
    if (castle.eliminated) continue;
    const ruler = state.rulers.find(r => r.slot === castle.slot);
    castle.palaceIntegrity = palaceIntegrity(castle);
    castle.palaceDefeatThreshold = palaceDefeatThreshold(state.tick);
    castle.keepCracking = castle.palaceDefeatThreshold > T.palace.destroyedBelow;
    const morale = typeof castle.morale === 'number' ? castle.morale : castle.morale?.value ?? T.morale.start;
    castle.surrenderTicks = morale <= T.rules.surrenderMorale ? (castle.surrenderTicks ?? 0) + 1 : 0;
    const reason = castle.palaceIntegrity < castle.palaceDefeatThreshold ? ELIM.PALACE
      : ruler && ruler.hp <= 0 ? ELIM.RULER
      : castle.surrendered || castle.surrenderTicks >= T.rules.surrenderS / K.DT || castle.initialPopulation > 0 && castle.population < castle.initialPopulation * T.rules.surrenderPopFrac ? ELIM.SURRENDER : null;
    if (reason) {
      castle.eliminated = true; castle.reason = reason;
      if (castle.stats) castle.stats.eliminatedTick = state.tick;
      ctx.emit?.(EV.CASTLE_ELIMINATED, { slot: castle.slot, reason });
    }
  }
  const alive = state.castles.filter(c => !c.eliminated);
  const teams = new Set(alive.map(c => state.slots.find(s => s.id === c.slot)?.team ?? c.slot));
  if (state.castles.length > 1 && teams.size <= 1) {
    state.outcome = { winners: alive.map(c => c.slot), draw: alive.length === 0, tick: state.tick };
    ctx.emit?.(EV.GAME_OVER, state.outcome);
  }
  return state.outcome;
}

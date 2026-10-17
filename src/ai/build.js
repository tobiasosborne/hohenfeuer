// src/ai/build.js - owns blueprint snapshots, rebuild budgets and lost-weapon replacement plans.
import { BLOCK, CMD, getBlock, getWeapon, K } from '../contracts.js';
import { TUNING as T } from '../tuning.js';
import { canDesignate } from '../npc/index.js';

/** Local adapter: public plot uses width/depth, typed type/meta arrays and x+width*z+layer*y. */
export function plotSize(plot) { return { w: plot.width ?? K.PLOT_W, d: plot.depth ?? K.PLOT_D, h: plot.height ?? K.PLOT_H }; }
export function decodeCell(plot, index) {
  const { w, d } = plotSize(plot), y = Math.floor(index / (w * d));
  return [index % w, y, Math.floor(index / w) % d];
}
export function cellIndex(plot, cell) { const { w, d } = plotSize(plot); return cell[0] + w * cell[2] + w * d * cell[1]; }
export function blockCost(id) {
  const registered = getBlock(id);
  if (registered) return registered.cost;
  // Core rows are public tuning data; unregistered plugin blocks cannot be priced.
  const key = Object.keys(BLOCK).find(key => BLOCK[key] === id)?.toLowerCase();
  return key ? T.blocks[key].cost : null;
}
export function weaponCost(id) { return (getWeapon(id) ?? T.weapons[id])?.cost ?? null; }
const sameCell = (a, b) => a && b && a.every((n, i) => n === b[i]);
function placementCell(weapon, castle) {
  if (weapon.at ?? weapon.cell) return weapon.at ?? weapon.cell;
  if (!weapon.pos) return null;
  const p = Array.isArray(weapon.pos) ? weapon.pos : [weapon.pos.x, weapon.pos.y, weapon.pos.z];
  const origin = castle.plot.origin ?? [0, 0, 0];
  const o = Array.isArray(origin) ? origin : [origin.x, origin.y, origin.z];
  return p.map((n, i) => Math.floor(n - o[i]));
}

/** Capture on the first public view, before destruction; never retain mutable plot arrays. */
export function captureBlueprint(castle, weapons = castle.weapons ?? []) {
  const cells = [], palace = [];
  for (let index = 0; index < castle.plot.type.length; index++) {
    const block = castle.plot.type[index], cell = decodeCell(castle.plot, index);
    if (block === BLOCK.AIR || cell[1] < T.world.buildMinY) continue;
    const entry = { index, cell, block, facing: (castle.plot.meta?.[index] ?? 0) & 3 };
    cells.push(entry);
    if (block === BLOCK.PALACE) palace.push(cell);
  }
  return { cells, palace, mountSpots: (castle.mountSpots ?? []).map(p => [...p]),
    weapons: weapons.map(w => ({ defId: w.defId ?? w.id, at: [...(w.at ?? w.cell ?? [0, 0, 0])], facing: w.facing ?? 0 })) };
}

/** Remaining gold after tactic reserve and, when supplied, cumulative income spending limit. */
function budget(castle, tactic, account) {
  let available = Math.max(0, castle.gold - T.ai.reserve[tactic]);
  if (account) available = Math.min(available, Math.max(0, account.incomeGold * T.ai.repairShare[tactic] - account.spentGold));
  return available;
}
function palaceDistance(cell, blueprint) {
  let nearest = Infinity;
  for (const p of blueprint.palace) {
    const dx = cell[0] - p[0], dy = cell[1] - p[1], dz = cell[2] - p[2];
    nearest = Math.min(nearest, dx * dx + dy * dy + dz * dz);
  }
  return nearest;
}

/** Up to four affordable missing cells, nearest palace first then plot index. No world writes. */
export function planRebuild(castle, blueprint, tactic, account, view = {}) {
  let available = budget(castle, tactic, account);
  const missing = blueprint.cells.filter(c => castle.plot.type[c.index] === BLOCK.AIR
    && canDesignate(castle, { type: CMD.DESIGNATE, cell: c.cell, block: c.block }, view)
    && !((castle.plot.meta?.[c.index] ?? 0) & 16) && blockCost(c.block) !== null
    && !(castle.designations ?? []).some(d => sameCell(d.cell, c.cell)));
  missing.sort((a, b) => palaceDistance(a.cell, blueprint) - palaceDistance(b.cell, blueprint) || a.index - b.index);
  const plan = [];
  const limit = Math.min(T.ai.buildPerThink, Math.max(0, T.world.maxOpenDesignations - (castle.npcDesignations?.length ?? castle.designations?.length ?? 0)));
  if (limit === 0) return plan;
  for (const cell of missing) {
    const cost = blockCost(cell.block);
    if (cost > available) continue;
    plan.push({ type: CMD.DESIGNATE, cell: [...cell.cell], block: cell.block, facing: cell.facing });
    available -= cost;
    if (plan.length === limit) break;
  }
  return plan;
}

/** Replace only initial weapon losses, deterministically at available CastleDef mountSpots. */
export function planWeaponReplacement(castle, blueprint, tactic, weapons, { weaponCap = T.world.weaponCapDefault, pending = (castle.npcDesignations ?? []).filter(d => d.weapon), view = {} } = {}) {
  const live = weapons.filter(w => w.hp === undefined || w.hp > 0), plan = [];
  let available = budget(castle, tactic), count = live.length + pending.length;
  const missing = [...blueprint.weapons];
  for (const weapon of [...live, ...pending]) {
    const i = missing.findIndex(w => w.defId === (weapon.defId ?? weapon.weapon ?? weapon.id));
    if (i >= 0) missing.splice(i, 1);
  }
  for (const weapon of missing) {
    const cost = weaponCost(weapon.defId);
    if (cost === null || cost > available || count >= weaponCap) continue;
    const spot = blueprint.mountSpots.find(p => ![...live, ...pending, ...plan].some(w => sameCell(placementCell(w, castle), p.slice(0, 3)))
      && canDesignate(castle, { type: CMD.DESIGNATE_WEAPON, weapon: weapon.defId, cell: p.slice(0, 3) }, { ...view, weapons: live, weaponCap }));
    if (!spot || plan.length >= T.world.maxOpenDesignations - (castle.npcDesignations?.length ?? 0)) continue;
    plan.push({ type: CMD.DESIGNATE_WEAPON, weapon: weapon.defId, cell: spot.slice(0, 3), facing: spot[3] });
    available -= cost; count++;
  }
  return plan;
}

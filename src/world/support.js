// src/world/support.js - owns resumable foundation connectivity and unsupported component collapse.
import { cellIndex, indexToCell, setCell } from './grid.js';
import { TUNING as T } from '../tuning.js';
const OFFSETS = [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]];
/** Create a per-plot work queue; doors and ladders are included in support by default. */
export function createSupport(plot, isSolid = type => type !== 0) {
  const state = { plot, isSolid, seeds: [], head: 0, seen: new Uint8Array(plot.type.length), active: null, version: plot.navVersion };
  Object.defineProperty(state, 'pending', { get: () => state.active !== null || state.head < state.seeds.length });
  return state;
}
/** Seed only local affected neighbours. Components may cross the 12-cell search boundary:
 * follow their actual foundation path instead of treating the boundary as an imaginary anchor.
 */
export function queueSupport(state, destroyed) {
  if (!state.pending) { state.seeds.length = 0; state.head = 0; state.seen.fill(0); }
  else { state.seen.fill(0); state.active = null; state.head = 0; }
  for (const p of destroyed) {
    const cell = typeof p === 'number' ? indexToCell(state.plot, p) : p;
    for (const [dx, dy, dz] of OFFSETS) { const i = cellIndex(state.plot, cell.x + dx, cell.y + dy, cell.z + dz); if (i >= 0) state.seeds.push(i); }
  }
  state.version = state.plot.navVersion;
}
/** Process at most budget visited solid cells. No removal occurs until a component is proven
 * unsupported. This prevents partially searched towers collapsing on budget exhaustion.
 */
export function stepSupport(state, budget = T.sim.collapseBudgetCells) {
  const { plot, isSolid } = state;
  if (state.version !== plot.navVersion) { state.active = null; state.head = 0; state.seen.fill(0); state.version = plot.navVersion; }
  let visited = 0;
  const collapsed = [];
  while (visited < budget && state.pending) {
    if (!state.active) {
      const start = state.seeds[state.head++];
      if (state.seen[start] || !isSolid(plot.type[start], start, plot)) continue;
      state.seen[start] = 1;
      state.active = { cells: [start], head: 0, supported: false };
    }
    const component = state.active;
    const index = component.cells[component.head++], cell = indexToCell(plot, index);
    visited++;
    if (cell.y === 0 && plot.hp[index] === T.hpIndestructible) component.supported = true;
    for (const [dx, dy, dz] of OFFSETS) {
      const i = cellIndex(plot, cell.x + dx, cell.y + dy, cell.z + dz);
      if (i >= 0 && !state.seen[i] && isSolid(plot.type[i], i, plot)) { state.seen[i] = 1; component.cells.push(i); }
    }
    if (component.head === component.cells.length) {
      if (!component.supported) {
        component.cells.sort((a, b) => a - b);
        for (const i of component.cells) { const p = indexToCell(plot, i); if (setCell(plot, p.x, p.y, p.z, 0, 0)) collapsed.push({ index: i, ...p }); }
        state.version = plot.navVersion;
      }
      state.active = null;
    }
  }
  return { visited, collapsed, pending: state.pending };
}

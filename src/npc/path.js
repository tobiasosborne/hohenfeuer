// src/npc/path.js - owns standability, deterministic A* and versioned path caches.
import { BLOCK, META } from '../contracts.js';
import { TUNING as T } from '../tuning.js';
import { blockDef, indexOf, cellOf, typeAt, manhattan } from './model.js';

const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
/** Doors pass walkers despite being solid to projectiles. Stairs occupy the feet cell. */
function clear(p, c) {
  const id = typeAt(p, c);
  return id !== null && (blockDef(id)?.passable || id === BLOCK.STAIRS);
}
/** Two metres of headroom plus a walkable floor, stair, or ladder rung. */
export function isStandable(plot, cell) {
  if (!clear(plot, cell)) return false;
  const head = typeAt(plot, [cell[0], cell[1] + 1, cell[2]]);
  if (head === null || blockDef(head)?.solid !== false) return false;
  const id = typeAt(plot, cell);
  return id === BLOCK.STAIRS || blockDef(id)?.climbable
    || Boolean(blockDef(typeAt(plot, [cell[0], cell[1] - 1, cell[2]]))?.walkOn);
}

/** Legal directed edges; every edge stays inside the owning plot. */
export function neighbors(plot, cell) {
  const [x, y, z] = cell, id = typeAt(plot, cell), edges = [], costs = T.npc.pathCost;
  if (!isStandable(plot, cell)) return edges;
  const add = (c, cost) => { if (isStandable(plot, c)) edges.push({ cell: c, cost }); };
  for (let d = 0; d < directions.length; d++) {
    const [dx, dz] = directions[d], same = [x + dx, y, z + dz];
    if (isStandable(plot, same)) add(same, typeAt(plot, same) === BLOCK.DOOR ? costs.door : costs.flat);
    else if (clear(plot, same)) add([x + dx, y - 1, z + dz], costs.stepDown);
    // A stair rises in its facing direction; reverse traversal descends onto that stair.
    if (id === BLOCK.STAIRS && (plot.meta[indexOf(plot, cell)] & META.FACING_MASK) === d
      && clear(plot, [x, y + 2, z])) add([x + dx, y + 1, z + dz], costs.stairs);
    const down = [x + dx, y - 1, z + dz], di = indexOf(plot, down);
    if (typeAt(plot, down) === BLOCK.STAIRS && (plot.meta[di] & META.FACING_MASK) === ((d + 2) & 3)) add(down, costs.stairs);
  }
  for (const dy of [-1, 1]) {
    const c = [x, y + dy, z];
    if (blockDef(id)?.climbable && blockDef(typeAt(plot, c))?.climbable) add(c, costs.ladder);
  }
  return edges;
}

/** Revalidation checks edges too: destroying a stair must break an otherwise clear route. */
export function pathValid(plot, path, start = 0, count = T.npc.pathRevalidateCells) {
  const end = Math.min(path.length, start + count);
  for (let i = start; i < end; i++) {
    if (!isStandable(plot, path[i])) return false;
    if (i > start && !neighbors(plot, path[i - 1]).some(e => indexOf(plot, e.cell) === indexOf(plot, path[i]))) return false;
  }
  return true;
}

function before(a, b) { return a.f < b.f || a.f === b.f && (a.h < b.h || a.h === b.h && a.i < b.i); }
function push(heap, n) {
  let i = heap.length; heap.push(n);
  while (i > 0) { const parent = Math.floor((i - 1) / 2); if (!before(n, heap[parent])) break; heap[i] = heap[parent]; i = parent; } heap[i] = n;
}
function pop(heap) {
  const first = heap[0], last = heap.pop();
  if (heap.length) { let i = 0; while (2 * i + 1 < heap.length) { let child = 2 * i + 1;
    if (child + 1 < heap.length && before(heap[child + 1], heap[child])) child++;
    if (!before(heap[child], last)) break; heap[i] = heap[child]; i = child;
  } heap[i] = last; } return first;
}

/** A* to any standable work cell. Null means no path within the expansion budget. */
export function findPathToAny(plot, start, goals, { maxExpansions = T.npc.pathMaxExpansions } = {}) {
  if (!isStandable(plot, start)) return null;
  goals = goals.filter(c => isStandable(plot, c));
  if (!goals.length) return null;
  const goalIds = new Set(goals.map(c => indexOf(plot, c))), startId = indexOf(plot, start);
  const heuristic = c => { let h = Infinity; for (const goal of goals) h = Math.min(h, manhattan(c, goal)); return h; };
  const h = heuristic(start), open = [], scores = new Map([[startId, 0]]), parents = new Map();
  push(open, { i: startId, g: 0, h, f: h });
  let expanded = 0;
  while (open.length && expanded < maxExpansions) {
    const node = pop(open);
    if (node.g !== scores.get(node.i)) continue;
    expanded++;
    if (goalIds.has(node.i)) {
      const path = []; let i = node.i;
      while (i !== undefined) { path.push(cellOf(plot, i)); i = parents.get(i); }
      return path.reverse();
    }
    for (const edge of neighbors(plot, cellOf(plot, node.i))) {
      const i = indexOf(plot, edge.cell), g = node.g + edge.cost;
      if (g >= (scores.get(i) ?? Infinity)) continue;
      scores.set(i, g); parents.set(i, node.i);
      const h = heuristic(edge.cell); push(open, { i, g, h, f: g + h });
    }
  }
  return null;
}
/** Return a start-inclusive path in plot-local cells, or null. */
export function findPath(plot, start, goal, options) { return findPathToAny(plot, start, [goal], options); }

/** Derived caches never hold authoritative state and automatically discard changed plots. */
export function createPathCache() {
  const plots = new WeakMap();
  return { find(plot, start, goal, options) {
    let cache = plots.get(plot);
    if (!cache || cache.version !== plot.navVersion) { cache = { version: plot.navVersion, paths: new Map() }; plots.set(plot, cache); }
    const key = `${indexOf(plot, start)}:${indexOf(plot, goal)}:${options?.maxExpansions ?? T.npc.pathMaxExpansions}`;
    if (!cache.paths.has(key)) {
      if (cache.paths.size >= T.npc.pathMaxExpansions) cache.paths.clear();
      cache.paths.set(key, findPath(plot, start, goal, options));
    }
    return cache.paths.get(key)?.map(c => [...c]) ?? null;
  } };
}

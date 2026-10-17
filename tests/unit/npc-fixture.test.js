// tests/unit/npc-fixture.test.js - owns deterministic NPC SimApi fixtures.
import { BLOCK, NPC_STATE, K } from '../../src/contracts.js';
import { TUNING as T } from '../../src/tuning.js';
import { createPlot, setCell, worldToCell, cellIndex } from '../../src/world/grid.js';

/** A real typed-array plot with the mutable SimApi extension already supplied by sim.js. */
export function fixture({ width = 12, depth = 8, height = 8, population = 0, id = 0 } = {}) {
  const plot = createPlot({ width, depth, height, id });
  const castle = { id, slot: id, plot, population, initialPopulation: population, gold: T.economy.startGold,
    morale: T.morale.start, shelter: false, workSpots: [{ x: 1.5, y: 1, z: 1.5 }],
    shelters: [[1, 1, 1, width - 2, 1, depth - 2]], exit: { x: 0.5, y: 1, z: 0.5 },
    rulerSpawn: { x: 1.5, y: 1, z: 1.5 }, throne: { x: 1.5, y: 1, z: 1.5 },
    palaceCells: [], initialPalaceHp: 0, magazines: [], stats: { losses: 0 } };
  const state = { tick: 0, castles: [castle], npcs: [], weapons: [], rulers: [], nextEntityId: K.MAX_SLOTS };
  const events = [];
  let draws = 0;
  const api = { get tick() { return state.tick; }, state, events, rng: () => () => { draws++; return 0.5; },
    emit(type, payload) { events.push({ type, payload }); }, castleOf: slot => state.castles.find(c => c.slot === slot),
    getBlock(pos) { const p = Array.isArray(pos) ? { x: pos[0], y: pos[1], z: pos[2] } : pos;
      const cell = worldToCell(plot, p), i = cellIndex(plot, cell.x, cell.y, cell.z);
      return i < 0 ? null : { id: plot.type[i], hp: plot.hp[i], meta: plot.meta[i], plot: id }; },
    setBlock(pos, block, meta = 0) { const p = Array.isArray(pos) ? { x: pos[0], y: pos[1], z: pos[2] } : pos;
      const c = worldToCell(plot, p); put(c.x, c.y, c.z, block, undefined, meta); },
    damageBlock(pos, dp) { const p = Array.isArray(pos) ? { x: pos[0], y: pos[1], z: pos[2] } : pos;
      const c = worldToCell(plot, p), i = cellIndex(plot, c.x, c.y, c.z);
      if (i >= 0) { plot.hp[i] = Math.max(0, plot.hp[i] - dp); if (!plot.hp[i]) put(c.x, c.y, c.z, BLOCK.AIR); } },
  };
  function put(x, y, z, block, hp, meta = 0) {
    const key = Object.keys(BLOCK).find(k => BLOCK[k] === block)?.toLowerCase();
    setCell(plot, x, y, z, block, hp ?? T.blocks[key]?.hp ?? 0, meta);
  }
  return { api, castle, state, plot, events, put, draws: () => draws };
}

/** Small plain NPC record, suitable for isolated claims and damage fixtures. */
export function person(id, role, cell = [1, 1, 1], castle = 0) {
  return { id, castle, slot: castle, role, state: NPC_STATE.IDLE, hp: T.people.hp,
    pos: { x: cell[0] + 0.5, y: cell[1], z: cell[2] + 0.5 }, carrying: 0,
    target: null, path: [], pathIndex: 0, jobId: null, fleeThreshold: 0 };
}

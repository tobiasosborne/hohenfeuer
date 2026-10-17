// src/tb3-script.js - owns the deterministic rampart designation slice shared by headless tests, goldens and video.
import { BLOCK, CMD, K } from './contracts.js';
import { createTb1Script } from './tb1-script.js';
import { atan2, sqrt } from './core/fmath.js';
import { TUNING as T } from './tuning.js';

export const TB3 = Object.freeze({
  cells: Object.freeze([25, 27, 29, 31, 33].map(z => Object.freeze([41, 7, z]))),
  designateTick: 280,
  maxBuildTicks: 900,
  block: BLOCK.STONE,
});

/** Walk the real stairs, stop before manning the cannon, then order five wall blocks. */
export function createTb3Script() {
  const walk = createTb1Script();
  let arrived = false, designated = false;
  return {
    get phase() { return designated ? 'build' : arrived ? 'designate' : 'walk'; },
    get build() { return { mode: 'block', block: TB3.block, weapon: 'cannon' }; },
    look(state) {
      const r = state.rulers[0], o = state.castles[0].plot.origin;
      const dx = o.x + 41.5 - r.pos.x, dz = o.z + 25.5 - r.pos.z;
      return { yaw: atan2(dx, -dz), pitch: atan2(o.y + 7 - r.pos.y - T.ruler.eye, sqrt(dx * dx + dz * dz)) };
    },
    next(state) {
      if (!arrived) {
        const commands = walk.next(state);
        if (walk.phase === 'man') arrived = true;
        return commands;
      }
      if (!designated && state.tick >= TB3.designateTick) {
        designated = true;
        return TB3.cells.map((cell, seq) => ({ type: CMD.DESIGNATE, slot: 0, tick: state.tick, seq, cell: [...cell], block: TB3.block, facing: 1 }));
      }
      return [];
    },
  };
}

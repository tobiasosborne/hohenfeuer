// src/world/castle-load.js - owns validated CastleDef ASCII expansion into plot state.
import { createPlot, setCell, cellToWorld } from './grid.js';
import { TUNING as T } from '../tuning.js';
/** Load a CastleDef using an injected block lookup; the definition is never mutated.
 * Layers start at y=1; size is [width,height,depth]. Placements are local cell coordinates.
 */
export function loadCastle(def, { origin = [0, 0, 0], getBlock, id = def.id } = {}) {
  if (!def || !Array.isArray(def.layers) || typeof getBlock !== 'function') throw new TypeError('Castle layers and getBlock are required');
  const [w, h, d] = def.size;
  if (w > T.world.plotW || h > T.world.plotH || d > T.world.plotD || def.layers.length > h || def.layers.length >= T.world.plotH) throw new RangeError('Castle exceeds plot');
  const plot = createPlot({ origin, id });
  let initialPalaceHp = 0;
  const palaceCells = [];
  for (let layer = 0; layer < def.layers.length; layer++) {
    const rows = def.layers[layer];
    if (rows.length !== d) throw new RangeError('Castle layer depth mismatch');
    for (let z = 0; z < rows.length; z++) {
      if (rows[z].length !== w) throw new RangeError('Castle row width mismatch');
      for (let x = 0; x < w; x++) {
        const char = rows[z][x];
        if (char === ' ' || char === '.') continue;
        const entry = def.legend[char];
        if (entry === undefined) throw new TypeError(`Unknown castle legend: ${char}`);
        const key = typeof entry === 'object' ? entry.key ?? entry.type : entry;
        const block = getBlock(key);
        if (!block || !Number.isInteger(block.id)) throw new TypeError(`Unknown block in legend: ${key}`);
        const meta = typeof entry === 'object' ? (entry.meta ?? ((entry.facing ?? 0) | (entry.variant ?? 0) << 2)) : 0;
        setCell(plot, x, layer + 1, z, block.id, block.hp, meta);
        if (block.key === 'palace' || key === 'palace') { palaceCells.push(x + plot.width * z + plot.width * plot.depth * (layer + 1)); initialPalaceHp += block.hp; }
      }
    }
  }
  const feet = p => p ? cellToWorld(plot, ...p, { x: 0.5, y: 0, z: 0.5 }) : null;
  return { id, defId: def.id, plot, initialPalaceHp, palaceCells, rulerSpawn: feet(def.rulerSpawn), throne: feet(def.throne), exit: feet(def.exit), weapons: (def.weapons ?? []).map((w, index) => ({ ...w, id: w.id, instance: index, at: [...w.at], pos: feet(w.at) })), mountSpots: (def.mountSpots ?? []).map(p => [...p]), shelters: (def.shelters ?? []).map(p => [...p]), workSpots: (def.workSpots ?? []).map(feet), population: def.population ?? 0 };
}
export const castleToGrid = loadCastle;

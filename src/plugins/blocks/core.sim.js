// src/plugins/blocks/core.sim.js - owns the fourteen core block definitions.
import { BLOCK, COLLIDER, registerBlock } from '../../contracts.js';
import { TUNING } from '../../tuning.js';

/** Build a palette entry with solid stone-like defaults and per-block exceptions.
 * Support follows solid cells plus the explicit ladder/door exception in DESIGN 2.2.
 * @param {number} id @param {string} key @param {string} de @param {string} en
 * @param {Partial<import('../../contracts.js').BlockDef>} [flags]
 * @returns {import('../../contracts.js').BlockDef}
 */
function block(id, key, de, en, flags = {}) {
  return Object.freeze({
    id, key, name: Object.freeze({ de, en }), ...TUNING.blocks[key],
    solid: true, walkOn: true, passable: false, projectileSolid: true,
    climbable: false, burnable: false, oriented: false, collider: COLLIDER.CUBE,
    mapOnly: TUNING.blocks[key].cost === null, ...flags,
  });
}

/** @type {ReadonlyArray<import('../../contracts.js').BlockDef>} */
export const CORE_BLOCKS = Object.freeze([
  block(BLOCK.AIR, 'air', 'Luft', 'Air', { solid: false, walkOn: false, passable: true, projectileSolid: false, collider: COLLIDER.NONE, mapOnly: true }),
  block(BLOCK.STONE, 'stone', 'Mauerstein', 'Stone'),
  block(BLOCK.TOWER, 'tower', 'Turmstein', 'Tower'),
  block(BLOCK.GATE, 'gate', 'Burgtor', 'Gatehouse'),
  block(BLOCK.WOOD, 'wood', 'Holz', 'Wood', { burnable: true }),
  block(BLOCK.FLOOR, 'floor', 'Holzboden', 'Floor', { burnable: true }),
  block(BLOCK.STAIRS, 'stairs', 'Treppe', 'Stairs', { oriented: 'h4', collider: COLLIDER.STAIRS }),
  block(BLOCK.LADDER, 'ladder', 'Leiter', 'Ladder', { solid: false, walkOn: false, passable: true, projectileSolid: false, climbable: true, oriented: 'h4', collider: COLLIDER.NONE }),
  block(BLOCK.DOOR, 'door', 'Tuer', 'Door', { solid: false, walkOn: false, passable: true, oriented: 'h4', collider: COLLIDER.NONE }),
  block(BLOCK.ROOF, 'roof', 'Dach', 'Roof', { walkOn: false, oriented: 'h4' }),
  block(BLOCK.MAGAZINE, 'magazine', 'Pulverkammer', 'Magazine'),
  block(BLOCK.PALACE, 'palace', 'Palast', 'Palace'),
  block(BLOCK.MOUNT, 'mount', 'Geschuetzsockel', 'Gun mount'),
  block(BLOCK.FOUNDATION, 'foundation', 'Fundament', 'Foundation'),
]);

/** Register the complete core palette; the orchestrator freezes the registries later. */
export function registerCoreBlocks() {
  for (const def of CORE_BLOCKS) registerBlock(def);
}

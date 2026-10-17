// src/plugins/maps/forest-duel.sim.js - owns the two-slot forest duel map definition.
import { registerMap } from '../../contracts.js';
import { TUNING } from '../../tuning.js';

const world = TUNING.world;
const leftX = (world.duelMapM[0] - world.duelDistanceM - world.plotW) / 2;
const plotZ = (world.duelMapM[1] - world.plotD) / 2;

/** Default createSim({ map: 'forest-duel', seed: FOREST_DUEL_SEED, slots }) input.
 * MapDef rejects seed/terrain.seed: the caller supplies the seed to createSim.
 * @type {number}
 */
export const FOREST_DUEL_SEED = 1;

/** Plot origins are minimum corners; equal footprints put centres 192 metres apart.
 * @type {import('../../contracts.js').MapDef}
 */
export const FOREST_DUEL = Object.freeze({
  id: 'forest-duel', name: Object.freeze({ de: 'Waldduell', en: 'Forest duel' }),
  biome: 'forest', size: world.duelMapM,
  slots: Object.freeze([
    Object.freeze({ origin: Object.freeze([leftX, 0, plotZ]), facingDeg: 90, castle: 'default' }),
    Object.freeze({ origin: Object.freeze([leftX + world.duelDistanceM, 0, plotZ]), facingDeg: 270, castle: 'default' }),
  ]),
  terrain: Object.freeze({ amp: world.terrainAmpMaxM, octaves: world.terrainOctaves, ridge: null }),
  water: null,
  wind: Object.freeze({ strength: TUNING.wind.defaultStrength, change: TUNING.wind.defaultChange }),
  startGold: TUNING.economy.startGold, weaponCap: world.weaponCapDefault, suddenDeathS: null,
});

/** Register the duel map; its castle and biome are cross-checked at registry freeze. */
export function registerForestDuel() { registerMap(FOREST_DUEL); }

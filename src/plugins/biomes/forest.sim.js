// src/plugins/biomes/forest.sim.js - owns forest terrain colours and cosmetic prop kinds.
import { registerBiome } from '../../contracts.js';

/** Terrain remains non-destructible; trees and rocks have no sim colliders.
 * DESIGN 2.3/7.2 specify colour families rather than exact forest RGB values.
 * @type {import('../../contracts.js').BiomeDef}
 */
export const FOREST = Object.freeze({
  id: 'forest', name: Object.freeze({ de: 'Wald', en: 'Forest' }),
  terrainPalette: Object.freeze({ grass: '#617b43', earth: '#79664c', rock: '#777b76' }),
  props: Object.freeze([Object.freeze({ id: 'conifer' }), Object.freeze({ id: 'rock' })]),
});

/** Register forest terrain metadata. */
export function registerForest() { registerBiome(FOREST); }

// src/plugins/biomes/forest.view.js - owns forest kit v0 sky, lighting and material descriptions.
import { registerBiomeView } from '../../contracts.js';
import { TUNING } from '../../tuning.js';

/** Flat colour kit v0; the painted sky/atlas textures are later renderer assets.
 * One warm directional sun and hemisphere light; no runtime shadow maps.
 * Exact RGB/light defaults are art choices because DESIGN 7.2 gives no forest numbers.
 * @type {import('../../contracts.js').BiomeView}
 */
export const FOREST_VIEW = Object.freeze({
  sky: Object.freeze({ color: '#91b7cd', horizon: '#c1d0c3', texture: null, cloudKind: 'cumulus', cloudLayers: 3 }),
  fog: Object.freeze({ color: '#b4c6bb', near: TUNING.ruler.fogNearM, far: TUNING.ruler.fogFarM }),
  sun: Object.freeze({ color: '#fff1cb', intensity: 1, direction: Object.freeze([-0.5, 1, -0.75]), castShadow: false }),
  hemi: Object.freeze({ sky: '#bbcfdf', ground: '#555d38', intensity: 0.6 }),
  atlas: Object.freeze({
    texture: null, material: 'MeshLambertMaterial', vertexColors: true,
    sizePx: TUNING.render.atlasPx, tilePx: TUNING.render.tilePx, gutterPx: TUNING.render.gutterPx,
    minFilter: 'LinearMipmapLinearFilter', anisotropy: 1, maxMip: TUNING.render.maxMip,
  }),
  props: Object.freeze([
    Object.freeze({ id: 'conifer', model: 'assets/kit-v0/conifer.glb', color: '#365638', collision: false }),
    Object.freeze({ id: 'rock', model: 'assets/kit-v0/rock.glb', color: '#777b76', collision: false }),
  ]),
});

/** Register forest render metadata; material creation and asset loading are renderer jobs. */
export function registerForestView() { registerBiomeView('forest', FOREST_VIEW); }

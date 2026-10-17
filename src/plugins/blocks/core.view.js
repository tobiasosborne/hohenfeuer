// src/plugins/blocks/core.view.js - owns kit v0 block colours and model references.
import { registerBlockView } from '../../contracts.js';

/** Surviving blocks use hp-derived states 0..3; zero hp removes the block entirely. */
export const DAMAGE_STATE_SUFFIXES = Object.freeze(['_z0', '_z1', '_z2', '_z3']);

/** Resolve a named mesh inside a kit GLB without loading the asset.
 * @param {string} key @param {number} state @returns {string}
 */
export function blockModelNode(key, state) {
  if (!Number.isInteger(state) || state < 0 || state >= DAMAGE_STATE_SUFFIXES.length) throw new RangeError('Damage state must be 0..3');
  return `${key}${DAMAGE_STATE_SUFFIXES[state]}`;
}

/** Flat Lambert vertex colours, shared across each block's faces for kit v0.
 * The renderer interprets the CSS colours in tiles without requiring an atlas texture.
 * @param {string} key @param {string} colour @returns {import('../../contracts.js').BlockView}
 */
function view(key, colour) {
  return Object.freeze({
    model: key === 'air' ? null : `assets/kit-v0/${key}.glb`,
    tiles: Object.freeze({ top: colour, side: colour, bottom: colour }),
    variants: DAMAGE_STATE_SUFFIXES.length,
  });
}

/** @type {Readonly<Record<string, import('../../contracts.js').BlockView>>} */
export const CORE_BLOCK_VIEWS = Object.freeze({
  air: view('air', '#000000'),
  stone: view('stone', '#858579'),
  tower: view('tower', '#777b76'),
  gate: view('gate', '#686b63'),
  wood: view('wood', '#795438'),
  floor: view('floor', '#a17a4d'),
  stairs: view('stairs', '#929286'),
  ladder: view('ladder', '#b18b51'),
  door: view('door', '#63442f'),
  roof: view('roof', '#904a36'),
  magazine: view('magazine', '#b49b70'),
  palace: view('palace', '#c8b991'),
  mount: view('mount', '#626a65'),
  foundation: view('foundation', '#50554d'),
});

/** Register block render descriptions; asset IO belongs to the renderer. */
export function registerCoreBlockViews() {
  for (const [key, blockView] of Object.entries(CORE_BLOCK_VIEWS)) registerBlockView(key, blockView);
}

// src/plugins/weapons/cannon/cannon.view.js - owns the cannon kit-v1 render description.
import { registerWeaponView } from '../../../contracts.js';
import { weaponView } from '../weapon-view.js';
import { TUNING } from '../../../tuning.js';

/** Frame, turntable and barrel correspond to the kit's Base -> Yaw -> Pitch tree. */
export const CANNON_PARTS = Object.freeze({ frame: 'Base', turntable: 'Yaw', barrel: 'Pitch', muzzle: 'Muzzle', sight: 'Sight' });

/** Local metres, forward = -Z, measured from the weapon's feet (matches Phase 1 sim).
 * WeaponView has no offset field; Muzzle is the authoritative GLB node.
 * @type {ReadonlyArray<number>}
 */
export const CANNON_MUZZLE_OFFSET = Object.freeze([
  0, TUNING.weaponRules.wallFootprint[2] * 0.75,
  -(TUNING.weaponRules.wallFootprint[0] / 2 + 2 * TUNING.weapons.cannon.projRadius),
]);

/** Reference colours for the clean-room kit; the renderer owns material instances. */
export const CANNON_MATERIALS = Object.freeze({
  frame: Object.freeze({ type: 'MeshLambertMaterial', color: '#795438' }),
  turntable: Object.freeze({ type: 'MeshLambertMaterial', color: '#50554d' }),
  barrel: Object.freeze({ type: 'MeshLambertMaterial', color: '#363e3c' }),
});

/** Asset and effect identifiers only; this module performs no asset IO.
 * @type {import('../../../contracts.js').WeaponView}
 */
export const CANNON_VIEW = Object.freeze({
  ...weaponView('cannon'),
  model: 'assets/kit-v1/cannon.glb',
  nodes: Object.freeze({ yaw: CANNON_PARTS.turntable, pitch: CANNON_PARTS.barrel, muzzle: CANNON_PARTS.muzzle, sight: CANNON_PARTS.sight }),
  fx: Object.freeze({ muzzle: 'cannon-flash', trail: 'cannon-smoke', impact: 'stone-impact' }),
  sfx: Object.freeze({ fire: 'cannon-fire', impact: 'cannon-impact' }),
});

/** Register the cannon's render metadata. */
export function registerCannonView() { registerWeaponView('cannon', CANNON_VIEW); }

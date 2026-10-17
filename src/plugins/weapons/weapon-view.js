// src/plugins/weapons/weapon-view.js - owns canonical view metadata and safe missing-model factories.
import { createWeaponView } from '../../render/weapon-view.js';
import { TUNING as T } from '../../tuning.js';
export const PARTS = Object.freeze({ frame: 'Base', turntable: 'Yaw', barrel: 'Pitch', muzzle: 'Muzzle', sight: 'Sight' });
/** Matches the shared legacy sim muzzle, forward=-Z; the authored Muzzle node is authoritative for render. */
export function muzzleOffset(radius) { return Object.freeze([0, T.weaponRules.wallFootprint[2] / 2, -(T.weaponRules.wallFootprint[0] / 2 + 2 * radius)]); }
/** Asset loading belongs to the renderer. Undefined/malformed models use its built-in cannon boxes. */
export function weaponView(id, { arm = false, fire = 'cannon-fire' } = {}) {
  return Object.freeze({
    model: `assets/kit-v1/${id}.glb`,
    nodes: Object.freeze({ yaw: 'Yaw', pitch: 'Pitch', muzzle: 'Muzzle', sight: 'Sight', ...(arm ? { arm: 'arm' } : {}) }),
    fx: Object.freeze({ muzzle: 'cannon-flash', trail: 'cannon-smoke', impact: 'stone-impact' }),
    sfx: Object.freeze({ fire, impact: 'cannon-impact' }),
    create({ model } = {}) {
      const valid = model?.getObjectByName && ['Yaw', 'Pitch', 'Muzzle', 'Sight'].every(name => model.name === name || model.getObjectByName(name));
      return createWeaponView(valid ? { model } : {});
    },
  });
}

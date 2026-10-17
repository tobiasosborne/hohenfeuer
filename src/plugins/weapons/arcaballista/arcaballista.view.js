// src/plugins/weapons/arcaballista/arcaballista.view.js - owns the arcaballista kit-v1 view description.
import { registerWeaponView } from '../../../contracts.js';
import { TUNING } from '../../../tuning.js';
import { PARTS, muzzleOffset, weaponView } from '../weapon-view.js';
export const ARCABALLISTA_PARTS = PARTS;
export const ARCABALLISTA_MUZZLE_OFFSET = muzzleOffset(TUNING.weapons['arcaballista'].projRadius);
export const ARCABALLISTA_VIEW = weaponView('arcaballista', { arm: false });
export function registerArcaballistaView() { registerWeaponView('arcaballista', ARCABALLISTA_VIEW); }

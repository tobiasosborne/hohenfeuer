// src/plugins/weapons/trebuchet/trebuchet.view.js - owns the trebuchet kit-v1 view description.
import { registerWeaponView } from '../../../contracts.js';
import { TUNING } from '../../../tuning.js';
import { PARTS, muzzleOffset, weaponView } from '../weapon-view.js';
export const TREBUCHET_PARTS = PARTS;
export const TREBUCHET_MUZZLE_OFFSET = muzzleOffset(TUNING.weapons['trebuchet'].projRadius);
export const TREBUCHET_VIEW = weaponView('trebuchet', { arm: true });
export function registerTrebuchetView() { registerWeaponView('trebuchet', TREBUCHET_VIEW); }

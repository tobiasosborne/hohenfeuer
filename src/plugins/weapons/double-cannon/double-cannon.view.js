// src/plugins/weapons/double-cannon/double-cannon.view.js - owns the double-cannon kit-v1 view description.
import { registerWeaponView } from '../../../contracts.js';
import { TUNING } from '../../../tuning.js';
import { PARTS, muzzleOffset, weaponView } from '../weapon-view.js';
export const DOUBLE_CANNON_PARTS = PARTS;
export const DOUBLE_CANNON_MUZZLE_OFFSET = muzzleOffset(TUNING.weapons['double-cannon'].projRadius);
export const DOUBLE_CANNON_VIEW = weaponView('double-cannon', { arm: false });
export function registerDoubleCannonView() { registerWeaponView('double-cannon', DOUBLE_CANNON_VIEW); }

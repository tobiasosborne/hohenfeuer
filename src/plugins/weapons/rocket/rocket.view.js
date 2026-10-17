// src/plugins/weapons/rocket/rocket.view.js - owns the rocket kit-v1 view description.
import { registerWeaponView } from '../../../contracts.js';
import { TUNING } from '../../../tuning.js';
import { PARTS, muzzleOffset, weaponView } from '../weapon-view.js';
export const ROCKET_PARTS = PARTS;
export const ROCKET_MUZZLE_OFFSET = muzzleOffset(TUNING.weapons['rocket'].projRadius);
export const ROCKET_VIEW = weaponView('rocket', { arm: false });
export function registerRocketView() { registerWeaponView('rocket', ROCKET_VIEW); }

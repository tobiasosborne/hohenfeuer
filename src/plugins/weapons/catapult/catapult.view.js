// src/plugins/weapons/catapult/catapult.view.js - owns the catapult kit-v1 view description.
import { registerWeaponView } from '../../../contracts.js';
import { TUNING } from '../../../tuning.js';
import { PARTS, muzzleOffset, weaponView } from '../weapon-view.js';
export const CATAPULT_PARTS = PARTS;
export const CATAPULT_MUZZLE_OFFSET = muzzleOffset(TUNING.weapons['catapult'].projRadius);
export const CATAPULT_VIEW = weaponView('catapult', { arm: true });
export function registerCatapultView() { registerWeaponView('catapult', CATAPULT_VIEW); }

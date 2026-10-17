// src/plugins/weapons/fire-catapult/fire-catapult.view.js - owns the fire-catapult kit-v1 view description.
import { registerWeaponView } from '../../../contracts.js';
import { TUNING } from '../../../tuning.js';
import { PARTS, muzzleOffset, weaponView } from '../weapon-view.js';
export const FIRE_CATAPULT_PARTS = PARTS;
export const FIRE_CATAPULT_MUZZLE_OFFSET = muzzleOffset(TUNING.weapons['fire-catapult'].projRadius);
export const FIRE_CATAPULT_VIEW = weaponView('fire-catapult', { arm: true });
export function registerFireCatapultView() { registerWeaponView('fire-catapult', FIRE_CATAPULT_VIEW); }

// src/plugins/weapons/hellfire/hellfire.view.js - owns the hellfire kit-v1 view description.
import { registerWeaponView } from '../../../contracts.js';
import { TUNING } from '../../../tuning.js';
import { PARTS, muzzleOffset, weaponView } from '../weapon-view.js';
export const HELLFIRE_PARTS = PARTS;
export const HELLFIRE_MUZZLE_OFFSET = muzzleOffset(TUNING.weapons['hellfire'].projRadius);
export const HELLFIRE_VIEW = weaponView('hellfire', { arm: false });
export function registerHellfireView() { registerWeaponView('hellfire', HELLFIRE_VIEW); }

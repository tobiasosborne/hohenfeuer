// src/plugins/weapons/ballista/ballista.view.js - owns the ballista kit-v1 view description.
import { registerWeaponView } from '../../../contracts.js';
import { TUNING } from '../../../tuning.js';
import { PARTS, muzzleOffset, weaponView } from '../weapon-view.js';
export const BALLISTA_PARTS = PARTS;
export const BALLISTA_MUZZLE_OFFSET = muzzleOffset(TUNING.weapons['ballista'].projRadius);
export const BALLISTA_VIEW = weaponView('ballista', { arm: false });
export function registerBallistaView() { registerWeaponView('ballista', BALLISTA_VIEW); }

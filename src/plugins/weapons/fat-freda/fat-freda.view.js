// src/plugins/weapons/fat-freda/fat-freda.view.js - owns the fat-freda kit-v1 view description.
import { registerWeaponView } from '../../../contracts.js';
import { TUNING } from '../../../tuning.js';
import { PARTS, muzzleOffset, weaponView } from '../weapon-view.js';
export const FAT_FREDA_PARTS = PARTS;
export const FAT_FREDA_MUZZLE_OFFSET = muzzleOffset(TUNING.weapons['fat-freda'].projRadius);
export const FAT_FREDA_VIEW = weaponView('fat-freda', { arm: false });
export function registerFatFredaView() { registerWeaponView('fat-freda', FAT_FREDA_VIEW); }

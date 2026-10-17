// src/plugins/weapons/bomb/bomb.view.js - owns the map-only bomb view placeholder.
import { registerWeaponView } from '../../../contracts.js';
import { PARTS, muzzleOffset, weaponView } from '../weapon-view.js';
export const BOMB_PARTS = PARTS;
export const BOMB_MUZZLE_OFFSET = muzzleOffset(0.15);
export const BOMB_VIEW = weaponView('bomb');
export function registerBombView() { registerWeaponView('bomb', BOMB_VIEW); }

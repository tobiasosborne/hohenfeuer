// src/plugins/weapons/zeppelin/zeppelin.view.js - owns the map-only zeppelin view placeholder.
import { registerWeaponView } from '../../../contracts.js';
import { PARTS, muzzleOffset, weaponView } from '../weapon-view.js';
export const ZEPPELIN_PARTS = PARTS;
export const ZEPPELIN_MUZZLE_OFFSET = muzzleOffset(0.15);
export const ZEPPELIN_VIEW = weaponView('zeppelin');
export function registerZeppelinView() { registerWeaponView('zeppelin', ZEPPELIN_VIEW); }

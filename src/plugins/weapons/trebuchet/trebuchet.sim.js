// src/plugins/weapons/trebuchet/trebuchet.sim.js - owns the trebuchet simulation plugin.
import { registerWeapon } from '../../../contracts.js';
import { TUNING } from '../../../tuning.js';
import { weaponDef } from '../weapon-def.js';

export const TREBUCHET = weaponDef('trebuchet', { de: 'Trebuchet', en: 'Trebuchet' }, TUNING.weapons['trebuchet']);
export function registerTrebuchet() { registerWeapon(TREBUCHET); }

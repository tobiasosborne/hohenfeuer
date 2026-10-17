// src/plugins/weapons/catapult/catapult.sim.js - owns the catapult simulation plugin.
import { registerWeapon } from '../../../contracts.js';
import { TUNING } from '../../../tuning.js';
import { weaponDef } from '../weapon-def.js';

export const CATAPULT = weaponDef('catapult', { de: 'Katapult', en: 'Catapult' }, TUNING.weapons['catapult']);
export function registerCatapult() { registerWeapon(CATAPULT); }

// src/plugins/weapons/fire-catapult/fire-catapult.sim.js - owns the fire-catapult simulation plugin.
import { registerWeapon } from '../../../contracts.js';
import { TUNING } from '../../../tuning.js';
import { weaponDef } from '../weapon-def.js';

export const FIRE_CATAPULT = weaponDef('fire-catapult', { de: 'Feuerkatapult', en: 'Fire catapult' }, TUNING.weapons['fire-catapult']);
export function registerFireCatapult() { registerWeapon(FIRE_CATAPULT); }

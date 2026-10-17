// src/plugins/weapons/double-cannon/double-cannon.sim.js - owns the double-cannon simulation plugin.
import { registerWeapon } from '../../../contracts.js';
import { TUNING } from '../../../tuning.js';
import { weaponDef } from '../weapon-def.js';

export const DOUBLE_CANNON = weaponDef('double-cannon', { de: 'Doppelkanone', en: 'Double cannon' }, TUNING.weapons['double-cannon']);
export function registerDoubleCannon() { registerWeapon(DOUBLE_CANNON); }

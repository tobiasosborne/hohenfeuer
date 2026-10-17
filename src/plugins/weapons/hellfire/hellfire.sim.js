// src/plugins/weapons/hellfire/hellfire.sim.js - owns the hellfire simulation plugin.
import { registerWeapon } from '../../../contracts.js';
import { TUNING } from '../../../tuning.js';
import { weaponDef } from '../weapon-def.js';

export const HELLFIRE = weaponDef('hellfire', { de: 'Hoellenorgel', en: 'Hellfire' }, TUNING.weapons['hellfire']);
export function registerHellfire() { registerWeapon(HELLFIRE); }

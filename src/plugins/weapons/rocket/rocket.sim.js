// src/plugins/weapons/rocket/rocket.sim.js - owns the rocket simulation plugin.
import { registerWeapon } from '../../../contracts.js';
import { TUNING } from '../../../tuning.js';
import { weaponDef } from '../weapon-def.js';

export const ROCKET = weaponDef('rocket', { de: 'Raketenwerfer', en: 'Rocket launcher' }, TUNING.weapons['rocket']);
export function registerRocket() { registerWeapon(ROCKET); }

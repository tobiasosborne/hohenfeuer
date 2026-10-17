// src/plugins/weapons/ballista/ballista.sim.js - owns the ballista simulation plugin.
import { registerWeapon } from '../../../contracts.js';
import { TUNING } from '../../../tuning.js';
import { weaponDef } from '../weapon-def.js';

export const BALLISTA = weaponDef('ballista', { de: 'Balliste', en: 'Ballista' }, TUNING.weapons['ballista']);
export function registerBallista() { registerWeapon(BALLISTA); }

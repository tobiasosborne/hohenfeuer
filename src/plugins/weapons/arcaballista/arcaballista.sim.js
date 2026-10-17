// src/plugins/weapons/arcaballista/arcaballista.sim.js - owns the arcaballista simulation plugin.
import { registerWeapon } from '../../../contracts.js';
import { TUNING } from '../../../tuning.js';
import { weaponDef } from '../weapon-def.js';

export const ARCABALLISTA = weaponDef('arcaballista', { de: 'Arkballiste', en: 'Arcaballista' }, TUNING.weapons['arcaballista']);
export function registerArcaballista() { registerWeapon(ARCABALLISTA); }

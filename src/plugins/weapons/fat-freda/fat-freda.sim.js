// src/plugins/weapons/fat-freda/fat-freda.sim.js - owns the fat-freda simulation plugin.
import { registerWeapon } from '../../../contracts.js';
import { TUNING } from '../../../tuning.js';
import { weaponDef } from '../weapon-def.js';

export const FAT_FREDA = weaponDef('fat-freda', { de: 'Dicke Luise', en: 'Fat Freda' }, TUNING.weapons['fat-freda']);
export function registerFatFreda() { registerWeapon(FAT_FREDA); }

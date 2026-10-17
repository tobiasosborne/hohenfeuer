// src/ai/aim.js - owns deterministic geometric aim, wind compensation and observed-miss learning.
import { K, CMD, CMD_FIELDS } from '../contracts.js';
import { TUNING as T } from '../tuning.js';
import { atan2, DEG, pow } from '../core/fmath.js';
import { buildRangeTable, dialToElevation, traceFlight } from '../sim/ballistics.js';

const tables = new WeakMap();
const wrap = deg => (deg % 360 + 360) % 360;
const signed = deg => wrap(deg + 180) - 180;
const round = n => Math.floor(n + 0.5);
/** Accept the contracts' tuples and the sim's public vector records. */
export const vector = p => Array.isArray(p) ? { x: p[0], y: p[1], z: p[2] } : p;
/** Derived immutable tables may be supplied by the sim, otherwise cached by WeaponDef. */
export function rangeTableFor(weapon) {
  if (!tables.has(weapon)) tables.set(weapon, buildRangeTable(weapon));
  return tables.get(weapon);
}

/**
 * Geometry uses flat zero-wind metres / dialUnitM; the production table clamps the band.
 * Two inverse-drift iterations use only the published wind vector. Height error remains
 * observable, as in DESIGN 3.3; no enemy aim or projectile internals are read.
 * @param {number[]|object} shooter @param {number[]|object} target
 * @param {object} weapon @param {{x:number,z:number}} wind
 * @param {object[]} table @returns {{azDeg:number,dial:number,elevation:number,reachable:boolean}}
 */
export function geometryAim(shooter, target, weapon, wind = { x: 0, z: 0 }, table = rangeTableFor(weapon)) {
  const from = vector(shooter), to = vector(target);
  const dx = to.x - from.x, dz = to.z - from.z;
  let aimX = dx, aimZ = dz;
  const lo = table[0].range, hi = table.at(-1).range;
  let azDeg, dial, elevation, distance;
  for (let i = 0; i <= 2; i++) {
    distance = Math.sqrt(aimX * aimX + aimZ * aimZ);
    azDeg = wrap(atan2(aimX, -aimZ) / DEG);
    dial = Math.max(lo, Math.min(hi, distance)) / T.aim.dialUnitM;
    elevation = dialToElevation(table, dial);
    if (i === 2 || wind.x === 0 && wind.z === 0) break;
    const calm = traceFlight({ ...weapon, elevation, azimuth: azDeg });
    const windy = traceFlight({ ...weapon, elevation, azimuth: azDeg, wind });
    aimX = dx - (windy.pos.x - calm.pos.x);
    aimZ = dz - (windy.pos.z - calm.pos.z);
  }
  return { azDeg, dial, elevation, reachable: distance >= lo && distance <= hi };
}

/** Serializable controller-owned memory; helpers never mutate their inputs. */
export function createAimMemory(targetId, castleSlot) {
  return { targetId, castleSlot, observations: 0, biasAzDeg: 0, biasDial: 0, lastShot: null };
}

/**
 * DESIGN 6.2's shared numeric floor is applied in each error coordinate: degrees
 * and fractional dial range. The contract has no independent range-floor knob.
 * The initial shot uses sigma0; subsequent shots use max(sigma0*shrink^k, floor).
 * @returns {{azDeg:number,rangeFrac:number}}
 */
export function aimNoise(level, observations) {
  if (!Number.isInteger(level) || level < T.ai.levelMin || level > T.ai.levelMax) throw new RangeError('Invalid AI level');
  const factor = T.ai.levelMax + 1 - level;
  const floor = T.ai.sMinCoefDeg * factor * factor;
  const decay = pow(T.ai.shrink, Math.max(0, observations));
  const azDeg = T.ai.sAz0PerLevelDeg * factor * decay;
  const rangeFrac = T.ai.sR0PerLevel * factor * decay;
  return observations === 0 ? { azDeg, rangeFrac } : { azDeg: Math.max(azDeg, floor), rangeFrac: Math.max(rangeFrac, floor) };
}

/** Bounded normal approximation mandated by DESIGN 3.1; six draws per aim. */
function normal(rng, sigma) { return (rng() + rng() + rng() - 1.5) * 2 * sigma; }

/** Return integer AIM fields; state/sequence stamping belongs to the controller. */
export function aimShot(solution, level, rng, memory = createAimMemory(null, null)) {
  const sigma = aimNoise(level, memory.observations);
  const az = wrap(solution.azDeg + memory.biasAzDeg + normal(rng, sigma.azDeg));
  const dial = solution.dial + memory.biasDial + normal(rng, sigma.rangeFrac) * solution.dial;
  return { az: round(az * T.aim.azUnitsPerDeg) % K.AZ_UNITS,
    range: Math.max(0, Math.min(CMD_FIELDS[CMD.AIM].range.max, round(dial * T.aim.rangeUnitsPerDial))) };
}

/** Anchor the next correction to the actual quantized shot, including exploration noise. */
export function recordAim(memory, solution, command) {
  return { ...memory, biasAzDeg: signed(command.az / T.aim.azUnitsPerDeg - solution.azDeg),
    biasDial: command.range / T.aim.rangeUnitsPerDial - solution.dial, lastShot: { ...command } };
}

/**
 * Correct the actual angular/radial impact offset, including drag, wind and height misses.
 * @param {object} memory @param {{shooter:object|number[],target:object|number[],impact:object|number[],level:number}} feedback
 */
export function observeImpact(memory, { shooter, target, impact, level }) {
  aimNoise(level, 0);
  const a = vector(shooter), b = vector(target), p = vector(impact);
  const dx = b.x - a.x, dz = b.z - a.z, ix = p.x - a.x, iz = p.z - a.z;
  const azError = signed((atan2(ix, -iz) - atan2(dx, -dz)) / DEG);
  const rangeError = (Math.sqrt(ix * ix + iz * iz) - Math.sqrt(dx * dx + dz * dz)) / T.aim.dialUnitM;
  const alpha = T.ai.alphaBase + T.ai.alphaPerLevel * level;
  return { ...memory, observations: memory.observations + 1,
    biasAzDeg: memory.biasAzDeg - alpha * azError, biasDial: memory.biasDial - alpha * rangeError };
}

/** A published wind change reopens exploration without discarding observed bias. */
export function windChanged(memory) { return { ...memory, observations: Math.max(0, memory.observations - T.ai.windResetSteps) }; }

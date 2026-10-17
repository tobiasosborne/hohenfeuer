// src/ai/aim.js - owns deterministic geometric aim, wind compensation and observed-miss learning.
import { K, CMD, CMD_FIELDS } from '../contracts.js';
import { TUNING as T } from '../tuning.js';
import { atan2, DEG, pow } from '../core/fmath.js';
import { buildRangeTable, dialToCharge, rangeToCharge, traceFlight, fixedElevation } from '../sim/ballistics.js';

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

/** Solve charge at the fixed pitch using public position/height and wind. The range
 * table seeds flat shots; height/wind use the same production integrator. No enemy
 * state beyond geometry is read. metresPerCharge converts observed radial misses.
 */
export function geometryAim(shooter, target, weapon, wind = { x: 0, z: 0 }, table = rangeTableFor(weapon)) {
  const from = vector(shooter), to = vector(target), dx = to.x - from.x, dz = to.z - from.z;
  const distance = Math.sqrt(dx * dx + dz * dz), elevation = fixedElevation(weapon);
  let azDeg = wrap(atan2(dx, -dz) / DEG), dial = rangeToCharge(table, distance), reachable = true;
  const flight = (charge, azimuth = azDeg) => traceFlight({ ...weapon, charge, elevation, azimuth, wind, pos: from, landingY: to.y });
  if (from.y === to.y && wind.x === 0 && wind.z === 0) {
    reachable = distance >= table[0].range && distance <= table.at(-1).range;
  } else {
    // Alternate charge bisection and bearing correction; wind drift is nonlinear in charge.
    for (let i = 0; i < 4; i++) {
      let lo = T.aim.chargeMin, hi = T.aim.chargeMax;
      const near = flight(lo), far = flight(hi);
      reachable = far.landed && distance <= far.range && distance >= near.range;
      for (let j = 0; j < 20; j++) {
        const mid = (lo + hi) / 2, result = flight(mid);
        if (!result.landed || result.range < distance) lo = mid; else hi = mid;
      }
      dial = (lo + hi) / 2;
      const result = flight(dial), ix = result.pos.x - from.x, iz = result.pos.z - from.z;
      azDeg = wrap(azDeg - signed(atan2(ix, -iz) / DEG - atan2(dx, -dz) / DEG));
    }
  }
  const low = dialToCharge(dial - 0.5), high = dialToCharge(dial + 0.5);
  const metresPerCharge = Math.max(1e-6, (flight(high).range - flight(low).range) / (high - low));
  return { azDeg, dial, charge: dial, elevation, reachable, distance, metresPerCharge };
}

/** Serializable controller-owned memory; helpers never mutate their inputs. */
export function createAimMemory(targetId, castleSlot) {
  return { targetId, castleSlot, observations: 0, biasAzDeg: 0, biasDial: 0, lastShot: null };
}

/**
 * Exploration floors have separate units: degrees of bearing and fractional range.
 * The initial shot uses sigma0; subsequent shots use max(sigma0*shrink^k, floor).
 * @returns {{azDeg:number,rangeFrac:number}}
 */
export function aimNoise(level, observations) {
  if (!Number.isInteger(level) || level < T.ai.levelMin || level > T.ai.levelMax) throw new RangeError('Invalid AI level');
  const factor = T.ai.levelMax + 1 - level;
  const floor = T.ai.sMinCoefDeg * factor * factor;
  const rangeFloor = T.ai.sMinRangeCoef * factor ** T.ai.sMinRangeExponent;
  const decay = pow(T.ai.shrink, Math.max(0, observations));
  const azDeg = T.ai.sAz0PerLevelDeg * factor * decay;
  const rangeFrac = T.ai.sR0PerLevel * factor * decay;
  return observations === 0 ? { azDeg, rangeFrac } : { azDeg: Math.max(azDeg, floor), rangeFrac: Math.max(rangeFrac, rangeFloor) };
}

/** Bounded normal approximation mandated by DESIGN 3.1; six draws per aim. */
function normal(rng, sigma) { return (rng() + rng() + rng() - 1.5) * 2 * sigma; }

/** Return integer AIM fields; state/sequence stamping belongs to the controller. */
export function aimShot(solution, level, rng, memory = createAimMemory(null, null)) {
  const sigma = aimNoise(level, memory.observations);
  const az = wrap(solution.azDeg + memory.biasAzDeg + normal(rng, sigma.azDeg));
  const dial = solution.dial + memory.biasDial + normal(rng, sigma.rangeFrac) * solution.distance / solution.metresPerCharge;
  return { az: round(az * T.aim.azUnitsPerDeg) % K.AZ_UNITS,
    range: Math.max(0, Math.min(CMD_FIELDS[CMD.AIM].range.max, round(dialToCharge(dial) * T.aim.rangeUnitsPerDial))) };
}

/** Anchor the next correction to the actual quantized shot, including exploration noise. */
export function recordAim(memory, solution, command) {
  return { ...memory, biasAzDeg: signed(command.az / T.aim.azUnitsPerDeg - solution.azDeg),
    biasDial: command.range / T.aim.rangeUnitsPerDial - solution.dial, metresPerCharge: solution.metresPerCharge, lastShot: { ...command } };
}

/**
 * Correct the actual angular/radial impact offset, including drag, wind and height misses.
 * @param {object} memory @param {{shooter:object|number[],target:object|number[],impact:object|number[],level:number}} feedback
 */
export function observeImpact(memory, { shooter, target, impact, level, weapon, wind = { x: 0, z: 0 } }) {
  aimNoise(level, 0);
  const a = vector(shooter), b = vector(target), p = vector(impact);
  const dx = b.x - a.x, dz = b.z - a.z, ix = p.x - a.x, iz = p.z - a.z;
  const azError = signed((atan2(ix, -iz) - atan2(dx, -dz)) / DEG);
  const metresPerCharge = memory.metresPerCharge ?? geometryAim(a, b, T.weapons.cannon).metresPerCharge;
  const rangeError = weapon
    ? geometryAim(a, p, weapon, wind).dial - geometryAim(a, b, weapon, wind).dial
    : (Math.sqrt(ix * ix + iz * iz) - Math.sqrt(dx * dx + dz * dz)) / metresPerCharge;
  const alpha = T.ai.alphaBase + T.ai.alphaPerLevel * level;
  return { ...memory, observations: memory.observations + 1,
    biasAzDeg: memory.biasAzDeg - alpha * azError, biasDial: memory.biasDial - alpha * rangeError };
}

/** A published wind change reopens exploration without discarding observed bias. */
export function windChanged(memory) { return { ...memory, observations: Math.max(0, memory.observations - T.ai.windResetSteps) }; }

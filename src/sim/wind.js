// src/sim/wind.js - owns the seeded mean-reverting wind walk and per-slot arrow memory.
import { TUNING as T } from '../tuning.js';
import { RNG_STREAM } from '../contracts.js';
import { createRng } from '../core/rng.js';
import { sin, cos, DEG } from '../core/fmath.js';
const wrap = degrees => (degrees % 360 + 360) % 360;
function interval(wind) { const mean = T.wind.meanIntervalSByChange[wind.change]; return mean ? mean * (T.wind.intervalJitter[0] + wind.rng() * (T.wind.intervalJitter[1] - T.wind.intervalJitter[0])) : null; }
/** Wind state accepts an independent injected stream, otherwise derives the wind stream. */
export function createWind({ seed = 0, rng = createRng(seed).fork(RNG_STREAM.WIND), strength = T.wind.defaultStrength, change = T.wind.defaultChange } = {}) {
  if (!Number.isInteger(strength) || strength < 0 || strength >= T.wind.maxSpeedByStrength.length || !Number.isInteger(change) || change < 0 || change >= T.wind.meanIntervalSByChange.length) throw new RangeError('Invalid wind setting');
  const wind = { strength, change, speed: rng() * T.wind.maxSpeedByStrength[strength], direction: rng() * 360, previousDirection: null, previousUntil: 0, changeId: 0, shotVersions: {}, time: 0, nextChange: null, rng };
  wind.nextChange = interval(wind);
  return wind;
}
/** Advance seconds (default one tick); return changes in chronological order. */
export function tickWind(wind, dt = 1 / T.sim.tickHz) {
  if (!(dt >= 0) || !Number.isFinite(dt)) throw new RangeError('Wind dt must be finite and nonnegative');
  wind.time += dt;
  const changes = [], max = T.wind.maxSpeedByStrength[wind.strength];
  while (wind.nextChange !== null && wind.time >= wind.nextChange) {
    wind.previousDirection = wind.direction;
    wind.previousUntil = wind.nextChange + T.wind.blueArrowS;
    wind.speed = Math.max(0, Math.min(max, T.wind.decay * wind.speed + (wind.rng() * 2 - 1) * T.wind.gustFrac * max));
    wind.direction = wrap(wind.direction + (wind.rng() * 2 - 1) * T.wind.turnDeg);
    wind.changeId++;
    changes.push({ time: wind.nextChange, speed: wind.speed, direction: wind.direction, previousDirection: wind.previousDirection });
    const next = interval(wind);
    wind.nextChange = next === null ? null : wind.nextChange + next;
  }
  return changes;
}
/** Horizontal wind velocity; exactly zero for calm wind. */
export function windVector(wind) { return wind.speed === 0 ? { x: 0, z: 0 } : { x: wind.speed * sin(wind.direction * DEG), z: -wind.speed * cos(wind.direction * DEG) }; }
/** Clear only this slot's blue arrow on its next shot. */
export function markWindShot(wind, slot = 0) { wind.shotVersions[slot] = wind.changeId; }
/** Compass values; directions are degrees the air blows toward. */
export function windHud(wind, slot = 0) { return { speed: Math.round(wind.speed), direction: wind.speed >= T.wind.redArrowMinSpeed ? wind.direction : null, previousDirection: wind.time < wind.previousUntil && wind.shotVersions[slot] !== wind.changeId ? wind.previousDirection : null }; }

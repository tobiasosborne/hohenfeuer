// src/sim/wind.js - owns the seeded original 256-entry wind cycle and per-slot arrow memory.
import { TUNING as T } from '../tuning.js';
import { RNG_STREAM } from '../contracts.js';
import { createRng } from '../core/rng.js';
import { sin, cos, DEG } from '../core/fmath.js';
const wrap = degrees => (degrees % 360 + 360) % 360;
const entryS = T.wind.ticksPerEntry * T.sim.nativeTickS;
/** Precompute once: magnitude is selected, directions change by +/-682 turn units.
 * research/11 6.3; independent seeded stream replaces the original shared 15-bit RNG.
 * Plain arrays/records deliberately survive existing sim snapshots and save/restore.
 */
export function createWind({ seed = 0, rng = createRng(seed).fork(RNG_STREAM.WIND), strength = T.wind.defaultStrength, change = T.wind.defaultChange, direction = T.wind.initialDirectionDeg } = {}) {
  if (!Number.isInteger(strength) || strength < 0 || strength >= T.wind.nativeSpeedByStrength.length || !Number.isInteger(change) || change < 0 || change >= T.wind.segmentBaseByChange.length) throw new RangeError('Invalid wind setting');
  const schedule = [], segments = [], draw = () => Math.floor(rng() * 32768);
  let angle = Math.round(direction * T.wind.turnUnits / 360), i = 0;
  while (i < T.wind.scheduleEntries) {
    let end = change ? i + T.wind.segmentBaseByChange[change] + (draw() & 31) : T.wind.scheduleEntries;
    if (end > T.wind.scheduleEntries - 10) end = T.wind.scheduleEntries;
    if (change) angle = (angle + draw() % (2 * T.wind.turnLimitUnits + 1) - T.wind.turnLimitUnits + T.wind.turnUnits) % T.wind.turnUnits;
    const dir = wrap(angle * 360 / T.wind.turnUnits);
    segments.push({ entry: i, direction: dir });
    while (i < end) { schedule.push(dir); i++; }
  }
  return { strength, change, speed: T.wind.maxSpeedByStrength[strength], direction: schedule[0],
    schedule, segments, segmentIndex: 0, cycle: 0, previousDirection: null, previousUntil: 0,
    changeId: 0, shotVersions: {}, time: 0,
    nextChange: change ? (segments[1]?.entry ?? T.wind.scheduleEntries) * entryS : null, rng };
}
/** Advance seconds; emit each segment transition, including cycle wrap, in order. */
export function tickWind(wind, dt = 1 / T.sim.tickHz) {
  if (!(dt >= 0) || !Number.isFinite(dt)) throw new RangeError('Wind dt must be finite and nonnegative');
  wind.time += dt;
  const changes = [];
  while (wind.nextChange !== null && wind.time + 1e-10 >= wind.nextChange) {
    const time = wind.nextChange;
    if (++wind.segmentIndex === wind.segments.length) { wind.segmentIndex = 0; wind.cycle++; }
    const direction = wind.segments[wind.segmentIndex].direction;
    if (direction !== wind.direction) {
      wind.previousDirection = wind.direction; wind.direction = direction;
      wind.previousUntil = time + T.wind.blueArrowS; wind.changeId++;
      changes.push({ time, speed: wind.speed, direction, previousDirection: wind.previousDirection });
    }
    const nextEntry = wind.segments[wind.segmentIndex + 1]?.entry ?? T.wind.scheduleEntries;
    wind.nextChange = (wind.cycle * T.wind.scheduleEntries + nextEntry) * entryS;
  }
  return changes;
}
export function windVector(wind) { return wind.speed === 0 ? { x: 0, z: 0 } : { x: wind.speed * sin(wind.direction * DEG), z: -wind.speed * cos(wind.direction * DEG) }; }
export function markWindShot(wind, slot = 0) { wind.shotVersions[slot] = wind.changeId; }
/** Keep the public HUD shape; central number is original strength 0..8, not m/s. */
export function windHud(wind, slot = 0) { return { speed: wind.strength, direction: wind.strength > 0 ? wind.direction : null, previousDirection: wind.time < wind.previousUntil && wind.shotVersions[slot] !== wind.changeId ? wind.previousDirection : null }; }

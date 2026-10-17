// src/sim/ballistics.js - owns 120 Hz projectile integration and monotonic range-dial conversion.
import { TUNING as T } from '../tuning.js';
import { TRAJ } from '../contracts.js';
import { sin, cos, sqrt, DEG } from '../core/fmath.js';
const ZERO_WIND = Object.freeze({ x: 0, z: 0 });
/** Launch velocity in world axes; azimuth clockwise from north, angles in degrees. */
export function launchVelocity(v0, elevation, azimuth = 0) {
  const horizontal = v0 * cos(elevation * DEG);
  return { x: horizontal * sin(azimuth * DEG), y: v0 * sin(elevation * DEG), z: -horizontal * cos(azimuth * DEG) };
}
/** Mutate one projectile with the clean-room DESIGN 3.3 semi-implicit formula. */
export function integrateProjectile(projectile, wind = ZERO_WIND, h = 1 / T.sim.tickHz / T.sim.substeps) {
  const { pos, vel } = projectile, k = projectile.k ?? 0;
  vel.x += k * (wind.x - vel.x) * h;
  vel.y -= T.sim.gravity * h;
  vel.z += k * (wind.z - vel.z) * h;
  pos.x += vel.x * h; pos.y += vel.y * h; pos.z += vel.z * h;
  return projectile;
}
/** Compute equal-height flight using the exact production integrator and interpolated final
 * segment. k is included in the no-wind table (drag still slows a shot when w=0).
 */
export function traceFlight({ v0, elevation, azimuth = 0, k = 0, wind = ZERO_WIND, pos = { x: 0, y: 0, z: 0 }, landingY = pos.y, maxTime = T.sim.projectileMaxLifeS }) {
  const projectile = { pos: { ...pos }, vel: launchVelocity(v0, elevation, azimuth), k };
  const h = 1 / T.sim.tickHz / T.sim.substeps;
  let elapsed = 0, prevX = pos.x, prevY = pos.y, prevZ = pos.z;
  if (projectile.vel.y <= 0 && pos.y <= landingY) return { pos: { ...pos }, range: 0, time: 0, landed: true };
  while (elapsed < maxTime) {
    prevX = projectile.pos.x; prevY = projectile.pos.y; prevZ = projectile.pos.z;
    integrateProjectile(projectile, wind, h); elapsed += h;
    if (projectile.pos.y <= landingY && projectile.vel.y < 0) {
      const t = (prevY - landingY) / (prevY - projectile.pos.y);
      const point = { x: prevX + (projectile.pos.x - prevX) * t, y: landingY, z: prevZ + (projectile.pos.z - prevZ) * t };
      return { pos: point, range: sqrt((point.x - pos.x) * (point.x - pos.x) + (point.z - pos.z) * (point.z - pos.z)), time: elapsed - h + t * h, landed: true };
    }
  }
  return { pos: projectile.pos, range: sqrt((projectile.pos.x - pos.x) * (projectile.pos.x - pos.x) + (projectile.pos.z - pos.z) * (projectile.pos.z - pos.z)), time: elapsed, landed: false };
}
/** Precompute strictly increasing flat-ground ranges. Straight: low branch; lobbed: high
 * branch enumerated from steep to shallow. Negative straight elevations have zero flat range.
 */
export function buildRangeTable(weapon) {
  if (!(weapon.v0 > 0) || !(weapon.k >= 0)) throw new TypeError('Weapon needs positive v0 and nonnegative k');
  const lobbed = weapon.traj === TRAJ.LOBBED;
  const band = weapon.elevDeg ?? (lobbed ? T.aim.lobbedElevDeg : T.aim.straightElevDeg);
  const min = Math.min(...band), max = Math.max(...band), step = T.aim.tableStepDeg;
  const count = Math.ceil((max - min) / step), table = [];
  for (let i = 0; i <= count; i++) {
    const elevation = lobbed ? Math.max(min, max - i * step) : Math.min(max, min + i * step);
    const range = traceFlight({ v0: weapon.v0, elevation, k: weapon.k }).range;
    if (!table.length || range > table.at(-1).range) table.push(Object.freeze({ elevation, range }));
    else if (range === 0 && table.length === 1) table[0] = Object.freeze({ elevation, range });
  }
  if (table.length < 2) throw new RangeError('Weapon elevation band has no monotonic range');
  return Object.freeze(table);
}
function interpolate(table, value, input, output, descending = false) {
  const sign = descending ? -1 : 1;
  if (sign * value <= sign * table[0][input]) return table[0][output];
  if (sign * value >= sign * table.at(-1)[input]) return table.at(-1)[output];
  let lo = 0, hi = table.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >>> 1; if (sign * table[mid][input] <= sign * value) lo = mid; else hi = mid; }
  const a = table[lo], b = table[hi], t = (value - a[input]) / (b[input] - a[input]);
  return a[output] + (b[output] - a[output]) * t;
}
/** Dial units (not integer command tenths) to elevation degrees. Out-of-band values clamp. */
export function dialToElevation(table, dial) { return interpolate(table, dial * T.aim.dialUnitM, 'range', 'elevation'); }
/** Elevation degrees back to flat-ground dial units. */
export function elevationToDial(table, elevation) { return interpolate(table, elevation, 'elevation', 'range', table[0].elevation > table.at(-1).elevation) / T.aim.dialUnitM; }

// src/sim/ballistics.js - owns fixed-elevation charge ballistics and converted quadratic air drag.
/* Clean-room conversion from research/11 sections 2-4, not original executable code.
 * Native length q = (5/256 renderer units) * (1/8 m/renderer unit) = 5/2048 m.
 * Native tick h0 = 0.062 s: V=K*charge*q/h0; g=33*q/h0^2=20.9590027 m/s^2;
 * quadratic drag k=C/(M*65536*q) [1/m], a=k*|W-V|*(W-V), including vertical.
 * The 1/8 metric scale calibrates full-charge cannon range to ~278 m for 192 m duels.
 * research/08/10 establish local 32x24-cell plateaus, 256 native units/cell; their
 * world origins/centre spacing remain undecoded. Scale is a gameplay choice, not a rip fact.
 * TB2-stabilised blast footprints use 3*q m/native unit on the 1m voxel castle:
 * cannon radius=4.6875 m. Renderer-size 12.5 m blasts bypassed protected keeps.
 * This is calibrated gameplay geometry, not a uniformly scaled original-world replica.
 * Damage remains defence points. Axes map to our north=-Z/east=+X.
 * We retain 120 Hz, velocity-first real-valued integration rather than the original
 * 62 ms integer wrapping/rounding; constants and force law agree, trajectories are
 * not bit-identical to x86. AIM.range keeps its contract 0..9999 tenths: divide by 10
 * and clamp to charge 1..255 (0 -> 1, >=2550 -> 255). No metres-per-dial rule remains.
 * WeaponDef cannot express fixed pitches/K: core IDs obtain metadata from T.weapons;
 * v0 is full-charge speed (rocket: fixed initial speed); k is quadratic.
 * Unknown plugins use their band
 * midpoint as a guessed fixed pitch and v0/255 for K. No contract shape is changed.
 */
import { TUNING as T } from '../tuning.js';
import { TRAJ } from '../contracts.js';
import { sin, cos, sqrt, DEG } from '../core/fmath.js';
const ZERO_WIND = Object.freeze({ x: 0, z: 0 });
const metadata = weapon => T.weapons[weapon.id ?? weapon.defId];
/** Reserved hooks are contract-compatible unavailable/map-only placeholders. */
export function unavailableWeapon() { return true; }
export const weaponAvailable = weapon => Boolean(weapon && weapon.onFire !== unavailableWeapon);
const propulsionFor = weapon => weapon.propulsion ?? metadata(weapon)?.propulsion;
export const dialToCharge = dial => Math.max(T.aim.chargeMin, Math.min(T.aim.chargeMax, dial));
export const chargeToDial = charge => dialToCharge(charge);
export function fixedElevation(weapon) {
  return weapon.elevationDeg ?? metadata(weapon)?.elevationDeg
    ?? (weapon.elevDeg ? (weapon.elevDeg[0] + weapon.elevDeg[1]) / 2
      : weapon.traj === TRAJ.LOBBED ? T.aim.fallbackLobbedDeg : T.aim.fallbackStraightDeg);
}
export function launchSpeed(weapon, charge) {
  const powered = propulsionFor(weapon);
  if (powered) return powered.initialSpeed * T.sim.nativePositionM / T.sim.nativeTickS;
  return (weapon.speedPerCharge ?? weapon.v0 / T.aim.chargeMax) * dialToCharge(charge);
}
/** Original four integer angular draws, with asymmetric vertical scatter (research/11 4.4).
 * Contract scatter.azDeg stores the maximum angular support; vFrac is unused here.
 */
export function scatterAngles(weapon, azimuth, rng) {
  const S = weapon.scatterTurnUnits ?? Math.round((weapon.scatter?.azDeg ?? weapon.sAzDeg ?? 0) * T.wind.turnUnits / 360);
  const draw = () => Math.floor(rng() * 32768) % (S + 1);
  const u1 = draw(), u2 = draw(), u3 = draw(), u4 = draw(), elevation = fixedElevation(weapon);
  const code = Math.round(elevation * T.wind.turnUnits / 360), m = code === 242 ? 5 : code === 418 ? 15 : 4;
  return { azimuth: azimuth + (u1 + u2 - S) * 360 / T.wind.turnUnits,
    elevation: elevation + Math.trunc((m * (u3 - S) + u4) / 4) * 360 / T.wind.turnUnits };
}
/** Launch velocity in world axes; azimuth clockwise from north, angles in degrees. */
export function launchVelocity(v0, elevation, azimuth = 0) {
  const horizontal = v0 * cos(elevation * DEG);
  return { x: horizontal * sin(azimuth * DEG), y: v0 * sin(elevation * DEG), z: -horizontal * cos(azimuth * DEG) };
}
/** Construct the same force state for real fire, AI traces and range tables. A rocket
 * burns charge native ticks, sheds mass, then becomes its one explosive child. The
 * original half-speed staging followed by twice-speed child release cancels here;
 * the single-child path preserves velocity without allocating a second entity. */
export function createFlightProjectile(weapon, { charge = T.aim.chargeMax, elevation = fixedElevation(weapon), azimuth = 0, pos = { x: 0, y: 0, z: 0 }, payload } = {}) {
  const projectile = { pos: { ...pos }, vel: launchVelocity(launchSpeed(weapon, charge), elevation, azimuth), k: weapon.k };
  if (payload) projectile.payload = { ...payload };
  const powered = propulsionFor(weapon);
  if (powered) {
    const burnS = dialToCharge(charge) * T.sim.nativeTickS;
    const mass = powered.massBase + powered.massPerCharge * dialToCharge(charge);
    projectile.k = powered.carrierC / (mass * T.sim.nativeDragDivisor * T.sim.nativePositionM);
    projectile.propulsion = { stage: 'powered', burnS, mass, massBase: powered.massBase,
      massRate: powered.massPerCharge / T.sim.nativeTickS,
      thrust: powered.thrust * T.sim.nativePositionM / T.sim.nativeTickS ** 2,
      carrierC: powered.carrierC,
      payloadK: powered.payloadC / (powered.payloadM * T.sim.nativeDragDivisor * T.sim.nativePositionM),
      payload: payload ? { ...payload } : null };
    if (payload) projectile.payload = { ...payload, direct: 1, splash: 1, splashRadius: 0, ignite: 0 };
  }
  return projectile;
}
export function integrateProjectile(projectile, wind = ZERO_WIND, h = 1 / T.sim.tickHz / T.sim.substeps) {
  const motor = projectile.propulsion;
  // Split the 120-Hz step exactly at burnout; this also keeps serialized stages stable.
  if (motor?.stage === 'powered' && motor.burnS < h - 1e-12) {
    const poweredH = motor.burnS;
    if (poweredH > 1e-12) integrateProjectile(projectile, wind, poweredH);
    else stagePayload(projectile);
    return integrateProjectile(projectile, wind, h - poweredH);
  }
  const { pos, vel } = projectile, k = projectile.k ?? 0;
  const vx = vel.x, vy = vel.y, vz = vel.z;
  const rx = wind.x - vx, ry = -vy, rz = wind.z - vz;
  const drag = k * sqrt(rx * rx + ry * ry + rz * rz);
  vel.x += drag * rx * h;
  vel.y += (drag * ry - T.sim.gravity) * h;
  vel.z += drag * rz * h;
  if (motor?.stage === 'powered') {
    const speed = sqrt(vx * vx + vy * vy + vz * vz), thrust = speed ? motor.thrust * h / speed : 0;
    vel.x += vx * thrust; vel.y += vy * thrust; vel.z += vz * thrust;
    motor.burnS = Math.max(0, motor.burnS - h);
    motor.mass = Math.max(motor.massBase, motor.mass - motor.massRate * h);
    projectile.k = motor.carrierC / (motor.mass * T.sim.nativeDragDivisor * T.sim.nativePositionM);
    if (motor.burnS < 1e-12) stagePayload(projectile);
  }
  pos.x += vel.x * h; pos.y += vel.y * h; pos.z += vel.z * h;
  return projectile;
}
function stagePayload(projectile) {
  const motor = projectile.propulsion;
  motor.stage = 'payload'; motor.burnS = 0; motor.mass = motor.massBase;
  projectile.k = motor.payloadK;
  if (motor.payload) projectile.payload = { ...motor.payload };
}
/** Use the production integrator; optional charge scales full-charge v0. Interpolate the
 * descending crossing at landingY, including height differences for the AI solver.
 */
export function traceFlight(options) {
  const { v0, charge, elevation, azimuth = 0, k = 0, wind = ZERO_WIND, pos = { x: 0, y: 0, z: 0 }, landingY = pos.y, maxTime = T.sim.projectileMaxLifeS } = options;
  // Preserve the original ordinary-artillery arithmetic for existing cannon replays.
  const speed = charge === undefined ? v0 : v0 * dialToCharge(charge) / T.aim.chargeMax;
  const projectile = propulsionFor(options)
    ? createFlightProjectile(options, { charge, elevation, azimuth, pos })
    : { pos: { ...pos }, vel: launchVelocity(speed, elevation, azimuth), k };
  const h = 1 / T.sim.tickHz / T.sim.substeps;
  let elapsed = 0, prevX = pos.x, prevY = pos.y, prevZ = pos.z;
  if (projectile.vel.y <= 0 && pos.y <= landingY) return { pos: { ...pos }, range: 0, time: 0, landed: true };
  while (elapsed < maxTime) {
    prevX = projectile.pos.x; prevY = projectile.pos.y; prevZ = projectile.pos.z;
    integrateProjectile(projectile, wind, h); elapsed += h;
    if (projectile.pos.y <= landingY && projectile.vel.y < 0) {
      if (prevY < landingY) return { pos: { ...projectile.pos }, range: 0, time: elapsed, landed: false };
      const t = (prevY - landingY) / (prevY - projectile.pos.y);
      const point = { x: prevX + (projectile.pos.x - prevX) * t, y: landingY, z: prevZ + (projectile.pos.z - prevZ) * t };
      return { pos: point, range: sqrt((point.x - pos.x) ** 2 + (point.z - pos.z) ** 2), time: elapsed - h + t * h, landed: true };
    }
  }
  return { pos: projectile.pos, range: sqrt((projectile.pos.x - pos.x) ** 2 + (projectile.pos.z - pos.z) ** 2), time: elapsed, landed: false };
}
/** Strictly increasing zero-wind ranges indexed by charge, with fixed elevation. */
export function buildRangeTable(weapon) {
  if (!(weapon.v0 > 0) || !(weapon.k >= 0)) throw new TypeError('Weapon needs positive v0 and nonnegative k');
  const elevation = fixedElevation(weapon), table = [];
  for (let charge = T.aim.chargeMin; charge <= T.aim.chargeMax; charge++) {
    const result = traceFlight({ ...weapon, v0: launchSpeed(weapon, charge),
      ...(propulsionFor(weapon) ? { charge } : {}), elevation, k: weapon.k });
    if (!result.landed) continue;
    const range = result.range;
    if (!table.length || range > table.at(-1).range) table.push(Object.freeze({ charge, elevation, range }));
  }
  return Object.freeze(table);
}
export function rangeToCharge(table, range) {
  if (range <= table[0].range) return table[0].charge;
  if (range >= table.at(-1).range) return table.at(-1).charge;
  let lo = 0, hi = table.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >>> 1; if (table[mid].range <= range) lo = mid; else hi = mid; }
  const a = table[lo], b = table[hi];
  return a.charge + (b.charge - a.charge) * (range - a.range) / (b.range - a.range);
}
/** Retained for main.js barrel rendering: elevation no longer varies with dial. */
export function dialToElevation(table, _dial) { return table[0].elevation; }
/** Deprecated compatibility export: elevation is not invertible; use chargeToDial instead. */
export function elevationToDial(_table, charge) { return chargeToDial(charge); }

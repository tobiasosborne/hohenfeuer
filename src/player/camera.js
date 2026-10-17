// src/player/camera.js - owns the player camera poses (walk, weapon, impact, death, ghost) and applying them to a three camera.
// IO by placement (drives a THREE.PerspectiveCamera) but imports nothing from three: the camera is
// passed in, so the pose math is testable in node. DESIGN 5 and 7.4; numbers from TUNING.ruler.
// Head bob is seeded and stepped by the fixed tick (DESIGN 10 rule 10) and off in golden mode.

import { CAMERA_MODE, K } from "../contracts.js";
import { TUNING } from "../tuning.js";
import { splitmix32 } from "../core/rng.js";

const R = TUNING.ruler;
const DEG = Math.PI / 180;
/** The tuning value is shared with the renderer's Sight helper. */
export const WEAPON_VIEW_PITCH_DEG = R.weaponViewPitchDeg;

/**
 * @typedef {{pos: number[], yaw: number, pitch: number, roll: number, fov: number}} Pose
 *   yaw clockwise from north (radians), pitch up positive, roll right positive, fov vertical degrees
 */

/**
 * Seeded head bob: phase in cycles, advanced only while walking, by the tick clock.
 * @param {number} seed @param {{enabled?: boolean}} [o]
 */
export function createHeadBob(seed, o = {}) {
  const enabled = o.enabled !== false;
  const phase0 = splitmix32(seed >>> 0)() / 4294967296;
  let t = 0;
  return {
    get phase() { const p = phase0 + R.headBobHz * t; return p - Math.floor(p); },
    /** @param {boolean} moving @param {number} [dt] seconds, default one tick */
    step(moving, dt = K.DT) { if (moving) t += dt; },
    /** Vertical eye offset in metres. */
    offset() { return enabled ? R.headBobM * Math.sin(2 * Math.PI * this.phase) : 0; },
  };
}

/** First-person pose at eye height. @param {{pos: number[], yaw: number, pitch: number}} ruler @param {number} bob */
export function walkPose(ruler, bob = 0) {
  return { pos: [ruler.pos[0], ruler.pos[1] + R.eye + bob, ruler.pos[2]], yaw: ruler.yaw, pitch: ruler.pitch, roll: 0, fov: R.fovDeg };
}

/**
 * Weapon view behind the gun (DESIGN 5): at the GLB `Sight` node when the renderer supplies one,
 * else the tuned shoulder offset behind/above/right of the weapon pivot along its azimuth.
 * @param {{pivot: number[], azDeg: number, sight?: number[]}} w @param {{yaw: number, pitch: number}} [freeLook] RMB offsets
 */
export function weaponPose(w, freeLook) {
  const az = w.azDeg * DEG;
  const dx = Math.sin(az), dz = -Math.cos(az);
  const pos = w.sight ? [w.sight[0], w.sight[1], w.sight[2]]
    : [w.pivot[0] - dx * R.sightBackM - dz * R.sightRightM,
      w.pivot[1] + R.sightUpM, w.pivot[2] - dz * R.sightBackM + dx * R.sightRightM];
  const fy = freeLook ? freeLook.yaw : 0, fp = freeLook ? freeLook.pitch : 0;
  return { pos, yaw: az + fy, pitch: WEAPON_VIEW_PITCH_DEG * DEG + fp, roll: 0, fov: R.weaponFovDeg };
}

/** Impact view: impactBackM behind and impactUpM above the impact on the weapon azimuth, looking at it. */
export function impactPose({ point, azDeg }) {
  const az = azDeg * DEG;
  const dx = Math.sin(az), dz = -Math.cos(az);
  return {
    pos: [point[0] - dx * R.impactBackM, point[1] + R.impactUpM, point[2] - dz * R.impactBackM],
    yaw: az, pitch: -Math.atan2(R.impactUpM, R.impactBackM), roll: 0, fov: R.fovDeg,
  };
}

/** Death cam: from `start`, drop to groundY + deathCamY and roll deathRollDeg over deathCamS (ease-out). */
export function deathPose(start, groundY, t) {
  const u = Math.min(1, Math.max(0, t / R.deathCamS));
  const e = 1 - (1 - u) * (1 - u);
  const y = start.pos[1] + (groundY + R.deathCamY - start.pos[1]) * e;
  return { pos: [start.pos[0], y, start.pos[2]], yaw: start.yaw, pitch: start.pitch * (1 - e), roll: R.deathRollDeg * DEG * e, fov: start.fov };
}

/** Ghost view of a dead ruler: free camera. */
export function ghostPose(g) { return { pos: [g.pos[0], g.pos[1], g.pos[2]], yaw: g.yaw, pitch: g.pitch, roll: 0, fov: R.fovDeg }; }

/**
 * Write a pose into a three camera: clockwise yaw -> rotation.y = -yaw, Euler order YXZ.
 * @param {{position: {set: Function}, rotation: {set: Function}, fov: number, updateProjectionMatrix: Function}} camera
 * @param {Pose} pose
 */
export function applyPose(camera, pose) {
  camera.position.set(pose.pos[0], pose.pos[1], pose.pos[2]);
  camera.rotation.set(pose.pitch, -pose.yaw, pose.roll, "YXZ");
  if (camera.fov !== pose.fov) { camera.fov = pose.fov; camera.updateProjectionMatrix(); }
}

const MODES = new Set(Object.values(CAMERA_MODE));

/**
 * Camera rig: picks the pose for the current CAMERA_MODE each frame and applies it.
 * frame = {mode, dt, ruler?: {pos, yaw, pitch, moving?}, weapon?: {pivot, azDeg, sight?}, freeLook?,
 *          impact?: {point, azDeg}, ghost?: {pos, yaw, pitch}, groundY?}
 * @param {object} camera three PerspectiveCamera (or anything with the same fields)
 * @param {{seed?: number, golden?: boolean}} [o]
 */
export function createCameraRig(camera, o = {}) {
  const bob = createHeadBob(o.seed ?? 1, { enabled: !o.golden });
  let mode = CAMERA_MODE.WALK, pose = null, deathStart = null, deathT = 0;
  camera.near = R.nearM; camera.far = R.farM;
  return {
    get mode() { return mode; },
    get pose() { return pose; },
    /** @param {object} f */
    update(f) {
      if (!MODES.has(f.mode)) throw new Error(`unknown camera mode ${f.mode}`);
      if (f.mode !== mode) {
        if (f.mode === CAMERA_MODE.DEATH) { deathStart = pose || walkPose(f.ruler, 0); deathT = 0; }
        mode = f.mode;
      }
      const dt = f.dt ?? K.DT;
      switch (mode) {
        case CAMERA_MODE.WALK:
          bob.step(f.ruler.moving !== false, dt);
          pose = walkPose(f.ruler, bob.offset());
          break;
        case CAMERA_MODE.WEAPON: pose = weaponPose(f.weapon, f.freeLook); break;
        case CAMERA_MODE.IMPACT: pose = impactPose(f.impact); break;
        case CAMERA_MODE.DEATH:
          deathT += dt;
          pose = deathPose(deathStart, f.groundY ?? deathStart.pos[1] - R.eye, deathT);
          break;
        case CAMERA_MODE.GHOST: pose = ghostPose(f.ghost); break;
      }
      applyPose(camera, pose);
      return pose;
    },
  };
}

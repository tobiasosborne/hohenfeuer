// src/render/debug-api.js - owns the golden-mode debug hook globalThis.__hohenfeuer (DESIGN 7.6): ready, scene, camera, renderer, setPose, stepTo, render, info, timeFrames.
import { TUNING } from "../tuning.js";

/**
 * Install the hook. `ready` stays false until the caller sets it after loading.
 * Pose JSON (tests/goldens/poses.json): { position: [x,y,z], yaw, pitch (radians, Euler YXZ as scripts/goldens.mjs),
 *   fov?: degrees, tick?: number, page?: string, width, height }.
 * @param {object} o
 * @param {ReturnType<import('./renderer.js').createRenderer>} o.view
 * @param {(tick: number) => void} [o.stepTo] advances the (future) sim to a tick; rendering follows
 * @param {object} [o.extras] extra fields exposed for tests
 */
export function installDebugApi({ view, stepTo, extras = {} }) {
  const { camera, scene, renderer } = view;
  const api = {
    ready: false,
    scene, camera, renderer, tick: 0,
    setPose(p) {
      if (p.tick !== undefined) api.stepTo(p.tick);
      camera.position.set(...p.position);
      camera.rotation.set(p.pitch ?? 0, p.yaw ?? 0, 0, "YXZ");
      camera.fov = p.fov ?? TUNING.ruler.fovDeg;
      camera.updateProjectionMatrix();
      view.render();
      return true;
    },
    stepTo(tick) {
      if (stepTo) stepTo(tick);
      api.tick = tick;
      view.render();
      return api.tick;
    },
    render() { view.render(); return view.info(); },
    info() { return view.info(); },
    /** Average wall time of n synchronous frames (render + 1 px readback to force completion). */
    timeFrames(n = 30) {
      const gl = renderer.getContext();
      const px = new Uint8Array(4);
      const times = [];
      for (let i = 0; i < n; i++) {
        const t0 = globalThis.performance.now();
        view.render();
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        times.push(globalThis.performance.now() - t0);
      }
      times.sort((a, b) => a - b);
      return { n, avgMs: times.reduce((s, t) => s + t, 0) / n, medianMs: times[n >> 1], maxMs: times[n - 1], ...view.info() };
    },
    ...extras,
  };
  globalThis.__hohenfeuer = api;
  return api;
}

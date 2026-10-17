// src/render/renderer.js - owns WebGLRenderer setup, scene lights/fog, the 1024x768 letterboxed frame and per-frame rendering (DESIGN 7.1, 7.2).
import * as THREE from "three";
import { TUNING } from "../tuning.js";

const R = TUNING.render;
const P = TUNING.ruler;

/** Biome look presets (render-only). Colours are sRGB hex. */
export const BIOME_LOOK = Object.freeze({
  forest: { fog: 0xb4c8dc, sun: 0xfff0d8, sunIntensity: 2.2, sky: 0xc8dcf0, ground: 0x5a6a40, hemiIntensity: 1.25 },
  desert: { fog: 0xe0cfa8, sun: 0xfff2d0, sunIntensity: 2.4, sky: 0xe8dcc0, ground: 0xa08050, hemiIntensity: 1.3 },
  ice: { fog: 0xd0dcea, sun: 0xf0f4ff, sunIntensity: 2.0, sky: 0xdce8f4, ground: 0x8090a0, hemiIntensity: 1.4 },
  volcano: { fog: 0x6a5a58, sun: 0xffc8a0, sunIntensity: 1.8, sky: 0x8a7a78, ground: 0x302824, hemiIntensity: 1.0 },
});

/**
 * @param {object} [o]
 * @param {HTMLCanvasElement} [o.canvas]
 * @param {string} [o.biome] key of BIOME_LOOK
 * @param {number[]} [o.sunDir] direction toward the sun
 * @param {boolean} [o.letterbox] scale the 1024x768 canvas to fit the window (default true)
 */
export function createRenderer({ canvas, biome = "forest", sunDir = [-0.55, 0.7, 0.45], letterbox = true } = {}) {
  const look = BIOME_LOOK[biome] ?? BIOME_LOOK.forest;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "default", preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(R.logicalW, R.logicalH, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = false;
  renderer.info.autoReset = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(look.fog);
  scene.fog = new THREE.Fog(look.fog, P.fogNearM, P.fogFarM);

  const camera = new THREE.PerspectiveCamera(P.fovDeg, R.logicalW / R.logicalH, P.nearM, P.farM);
  camera.rotation.order = "YXZ";

  const hemi = new THREE.HemisphereLight(look.sky, look.ground, look.hemiIntensity);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(look.sun, look.sunIntensity);
  const s = new THREE.Vector3(...sunDir).normalize();
  sun.position.copy(s).multiplyScalar(100);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = false;
  scene.add(sun, sun.target);

  const el = renderer.domElement;
  function fit() {
    if (!letterbox || typeof globalThis.innerWidth !== "number") return;
    const k = Math.min(globalThis.innerWidth / R.logicalW, globalThis.innerHeight / R.logicalH);
    const w = Math.floor(R.logicalW * k), h = Math.floor(R.logicalH * k);
    Object.assign(el.style, { width: `${w}px`, height: `${h}px`, position: "absolute",
      left: `${Math.floor((globalThis.innerWidth - w) / 2)}px`, top: `${Math.floor((globalThis.innerHeight - h) / 2)}px` });
  }
  fit();
  if (letterbox && globalThis.addEventListener) globalThis.addEventListener("resize", fit);

  const beforeRender = [];
  function render() {
    for (const f of beforeRender) f(camera);
    renderer.render(scene, camera);
  }

  return {
    renderer, scene, camera, sun, hemi, look, domElement: el, render,
    /** Register a per-frame hook (camera) => void, e.g. sky following the camera. */
    onBeforeRender(f) { beforeRender.push(f); },
    info() {
      const r = renderer.info.render, m = renderer.info.memory;
      return { calls: r.calls, triangles: r.triangles, geometries: m.geometries, textures: m.textures };
    },
    dispose() { if (globalThis.removeEventListener) globalThis.removeEventListener("resize", fit); renderer.dispose(); },
  };
}

// src/render/renderer.js - owns WebGLRenderer setup, scene lights/fog, the 1024x768 letterboxed frame and per-frame rendering (DESIGN 7.1, 7.2).
import * as THREE from "three";
import { TUNING } from "../tuning.js";

import { resolveStyle, gpuExtrasEnabled } from './styles.js';
import { createStyleController } from './style-scene.js';
import { createGpuExtras } from './gpu-extras.js';

const R = TUNING.render;
const P = TUNING.ruler;

/** Biome look presets (render-only). Colours are sRGB hex. */
export const BIOME_LOOK = Object.freeze({
  forest: { fog: 0x6984a4, fogNearM: 160, fogFarM: 850, sun: 0xfff1db, sunIntensity: 2.2, sky: 0xe4e9ef, ground: 0xc2b8a6, hemiIntensity: 4.8 },
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
export function createRenderer({ canvas, biome = "forest", sunDir = [-0.5, 1, -0.75], letterbox = true, style = "classic", golden = new URLSearchParams(globalThis.location?.search ?? "").get("golden") === "1", gpuExtras = R.gpuExtras } = {}) {
  golden = golden || new URLSearchParams(globalThis.location?.search ?? "").get("golden") === "1";
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
  scene.fog = new THREE.Fog(look.fog, look.fogNearM ?? P.fogNearM, look.fogFarM ?? P.fogFarM);

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
  const styles = createStyleController({ scene, sunDir });
  const classicFog = scene.fog, classicBackground = scene.background;
  let stateSource = () => null, post = null;
  function setStyle(name) {
    // Validate before changing any renderer state.
    styles.setStyle(name);
    post?.dispose(); post = null;
    const modern = name === "modern";
    renderer.toneMapping = modern ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    renderer.toneMappingExposure = modern ? R.modern.exposure : 1;
    scene.background = modern ? new THREE.Color(R.modern.fog) : classicBackground;
    scene.fog = modern ? new THREE.FogExp2(R.modern.fog, R.modern.fogDensity) : classicFog;
    hemi.intensity = modern ? 2.8 : look.hemiIntensity;
    sun.intensity = modern ? 2.6 : look.sunIntensity;
    const enabled = gpuExtrasEnabled({ style: name, golden, requested: gpuExtras });
    renderer.shadowMap.enabled = sun.castShadow = enabled;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    if (enabled) {
      sun.shadow.mapSize.set(R.modern.shadowSize, R.modern.shadowSize);
      const extent = R.modern.shadowExtentM;
      Object.assign(sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 1, far: 650 });
      sun.shadow.camera.updateProjectionMatrix(); sun.shadow.normalBias = .06; sun.shadow.bias = -.00015;
      post = createGpuExtras(renderer, scene, camera);
    } else {
      sun.position.copy(s).multiplyScalar(100); sun.target.position.set(0, 0, 0);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    return name;
  }
  setStyle(resolveStyle(style).name);
  function render() {
    for (const f of beforeRender) f(camera);
    styles.update(stateSource());
    if (post) {
      sun.target.position.set(camera.position.x, 0, camera.position.z);
      sun.position.copy(s).multiplyScalar(300).add(sun.target.position);
      renderer.info.autoReset = false; renderer.info.reset(); post.render(); renderer.info.autoReset = true;
    } else renderer.render(scene, camera);
  }

  return {
    renderer, scene, camera, sun, hemi, look, domElement: el, render, setStyle,
    get style() { return styles.style; },
    get gpuExtras() { return !!post; },
    setStateSource(source) { stateSource = source; },
    /** Register a per-frame hook (camera) => void, e.g. sky following the camera. */
    onBeforeRender(f) { beforeRender.push(f); },
    info() {
      const r = renderer.info.render, m = renderer.info.memory;
      return { calls: r.calls, triangles: r.triangles, geometries: m.geometries, textures: m.textures, style: styles.style, gpuExtras: !!post };
    },
    dispose() { if (globalThis.removeEventListener) globalThis.removeEventListener("resize", fit); post?.dispose(); styles.dispose(); sun.shadow.map?.dispose(); renderer.dispose(); },
  };
}

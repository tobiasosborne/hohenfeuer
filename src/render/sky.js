// src/render/sky.js - owns the sky dome: vertical gradient plus seeded value-noise cumulus band, following the camera (DESIGN 7.2).
import * as THREE from "three";
import { createRng } from "../core/rng.js";

/**
 * @param {object} [o]
 * @param {number} [o.seed]
 * @param {number} [o.radius] metres; must stay inside the camera far plane
 * @param {number} [o.zenith] sRGB hex @param {number} [o.horizon] sRGB hex
 * @param {number} [o.cover] cloud cover 0..1
 */
export function createSky({ seed = 1, radius = 1400, zenith = 0x3f6fb4, horizon = 0xc8dcf0, cover = 0.45 } = {}) {
  const W = 512, H = 128;
  const rng = createRng(seed);
  const G = 16; // lattice cells across the texture width
  const lattice = Array.from({ length: (G + 1) * 9 }, () => rng());
  const lat = (i, j) => lattice[(i % G) + (G + 1) * j];
  const smooth = (t) => t * t * (3 - 2 * t);
  const noise = (u, v, f) => {
    const x = u * G * f, y = v * 8 * f;
    const i = Math.floor(x), j = Math.floor(y) % 8, tx = smooth(x - i), ty = smooth(y - Math.floor(y));
    const a = lat(i, j) + (lat(i + 1, j) - lat(i, j)) * tx, b = lat(i, j + 1) + (lat(i + 1, j + 1) - lat(i, j + 1)) * tx;
    return a + (b - a) * ty;
  };
  const zc = new THREE.Color(zenith), hc = new THREE.Color(horizon);
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1); // 0 at the horizon, 1 at the zenith
    const base = hc.clone().lerp(zc, Math.min(1, v * 1.6));
    const band = Math.max(0, 1 - Math.abs(v - 0.16) / 0.16); // clouds hug the lower sky (0..30 deg)
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const n = noise(u, v, 1) * 0.6 + noise(u, v, 2) * 0.3 + noise(u, v, 4) * 0.1;
      const c = Math.max(0, Math.min(1, (n - (1 - cover)) * 3.2)) * band;
      const shade = 0.82 + 0.18 * v;
      const i = (x + W * y) * 4;
      data[i] = Math.round(255 * (base.r + (shade - base.r) * c));
      data[i + 1] = Math.round(255 * (base.g + (shade - base.g) * c));
      data[i + 2] = Math.round(255 * (base.b + (shade * 1.02 - base.b) * c));
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;

  // Upper hemisphere plus a small skirt below the horizon. Sphere uv.y = 1 - theta/thetaLength; remap so texture
  // row v = elevation / 90 deg (0 at the horizon, 1 at the zenith).
  const thetaLength = Math.PI / 2 + 0.08;
  const geo = new THREE.SphereGeometry(radius, 48, 24, 0, Math.PI * 2, 0, thetaLength);
  const uv = geo.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) {
    const theta = (1 - uv.getY(i)) * thetaLength;
    uv.setY(i, Math.max(0, Math.min(1, 1 - theta / (Math.PI / 2))));
  }
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "sky";
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return {
    mesh,
    /** Keep the dome centred on the camera. */
    follow(camera) { mesh.position.set(camera.position.x, 0, camera.position.z); },
    dispose() { geo.dispose(); mat.dispose(); tex.dispose(); },
  };
}

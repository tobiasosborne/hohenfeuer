// src/render/sky.js - owns the camera-centred sky dome and independently painted, seeded cumulus layers (DESIGN 7.2).
import * as THREE from "three";
import { createRng } from "../core/rng.js";

/** Paint in sRGB byte space: THREE.Color(hex) is linear and must not be stored as sRGB bytes. */
const rgb = (hex) => [(hex >>> 16) & 255, (hex >>> 8) & 255, hex & 255];
const smooth = (t) => { const k = Math.max(0, Math.min(1, t)); return k * k * (3 - 2 * k); };

/** Deterministic authored cloud lobes; no photograph or reference pixels enter this texture. */
export function createSky({ seed = 1, radius = 1400, zenith = 0x314f7b, horizon = 0x6984a4, cover = 0.45 } = {}) {
  const W = 2048, H = 512, rng = createRng(seed);
  const zc = rgb(zenith), hc = rgb(horizon);
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    const blend = Math.min(1, y / (H - 1) * 2.5);
    for (let x = 0; x < W; x++) {
      const i = (x + W * y) * 4;
      for (let c = 0; c < 3; c++) data[i + c] = Math.round(hc[c] + (zc[c] - hc[c]) * blend);
      data[i + 3] = 255;
    }
  }
  // Three depth bands, with grey undersides and bright scalloped crowns. Periodic horizontal
  // coordinates make the longitude seam invisible; cloud phase is fixed for golden captures.
  if (cover > 0) for (let layer = 0; layer < 3; layer++) {
    const count = 14 - layer * 3, lobes = [];
    for (let k = 0; k < count; k++) {
      const u = (k + rng() * 0.6) / count;
      const v = 0.016 + layer * 0.038 + rng() * 0.025;
      const width = 0.016 + layer * 0.006 + rng() * 0.012;
      for (let l = 0; l < 6; l++) {
        const cx = u + (l / 5 - 0.5) * width * 2;
        const ry = (0.012 + layer * 0.011) * (0.5 + rng() * 0.95);
        lobes.push({ cx, cy: v + ry * (0.25 + rng() * 0.5), rx: width * (0.26 + rng() * 0.27), ry, base: v });
      }
    }
    const opacity = new Float32Array(W * H), light = new Float32Array(W * H);
    for (const p of lobes) {
      const y0 = Math.max(1, Math.floor((p.cy - p.ry * 1.15) * H)), y1 = Math.min(H - 1, Math.ceil((p.cy + p.ry * 1.15) * H));
      const x0 = Math.floor((p.cx - p.rx * 1.15) * W), x1 = Math.ceil((p.cx + p.rx * 1.15) * W);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = (x / W - p.cx) / p.rx, dy = (y / H - p.cy) / p.ry;
        const edge = 1 - Math.sqrt(dx * dx + dy * dy);
        const ripple = Math.sin(x * 0.47 + Math.sin(y * 0.61) * 2) * Math.sin(y * 0.83 + x * 0.14) * 0.085;
        const a = smooth((edge + ripple) / 0.12) * Math.min(1, cover / 0.45) * (0.65 + layer * 0.12);
        const i = ((x % W + W) % W) + y * W;
        const detail = Math.sin(x * .21 + Math.sin(y * .12) * 2) * Math.sin(y * .29 + x * .07) * 6;
        const shade = 132 + smooth((dy + 0.7) / 1.5) * 89 + (1 - dx) * 5 + detail;
        if (a > opacity[i]) { opacity[i] = a; light[i] = shade; }
      }
    }
    for (let i = 0; i < W * H; i++) {
      const a = opacity[i];
      if (!a) continue;
      for (let c = 0; c < 3; c++) data[i * 4 + c] = Math.round(data[i * 4 + c] * (1 - a) + (light[i] + c * 1.5) * a);
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  const thetaLength = Math.PI / 2 + 0.08;
  const geo = new THREE.SphereGeometry(radius, 64, 32, 0, Math.PI * 2, 0, thetaLength);
  const uv = geo.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) {
    const theta = (1 - uv.getY(i)) * thetaLength;
    uv.setY(i, Math.max(0, Math.min(1, 1 - theta / (Math.PI / 2))));
  }
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "sky"; mesh.renderOrder = -1; mesh.frustumCulled = false;
  return { mesh, follow(camera) { mesh.position.copy(camera.position); }, dispose() { geo.dispose(); mat.dispose(); tex.dispose(); } };
}

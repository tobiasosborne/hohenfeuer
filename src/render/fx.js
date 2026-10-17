// src/render/fx.js - owns minimal seeded particle effects: additive muzzle flash, normal-blend impact puffs (DESIGN 7.2).
import * as THREE from "three";
import { createRng } from "../core/rng.js";

function softDisk(size = 64) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x + 0.5) / size - 0.5, dy = (y + 0.5) / size - 0.5;
    const a = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 2);
    const i = (x + size * y) * 4;
    data[i] = data[i + 1] = data[i + 2] = 255;
    data[i + 3] = Math.round(255 * a * a);
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}

/**
 * @param {object} o
 * @param {THREE.Object3D} o.scene
 * @param {number} [o.seed]
 * @param {number} [o.max] pooled sprites
 */
export function createFx({ scene, seed = 1, max = 64 }) {
  const rng = createRng(seed);
  const tex = softDisk();
  const pool = [];
  const group = new THREE.Group(); group.name = "fx";
  scene.add(group);
  for (let i = 0; i < max; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: true }));
    s.visible = false;
    group.add(s);
    pool.push({ sprite: s, age: 0, life: 0, grow: 0, size: 0, vy: 0, alpha: 1 });
  }
  function spawn({ pos, color, additive, life, size, grow, vy = 0, alpha = 1 }) {
    const p = pool.find((q) => !q.sprite.visible) ?? pool.reduce((a, b) => (a.age / a.life > b.age / b.life ? a : b));
    const m = p.sprite.material;
    m.color.setHex(color);
    m.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    m.opacity = alpha;
    m.needsUpdate = true;
    p.sprite.position.copy(pos);
    p.sprite.scale.setScalar(size);
    p.sprite.visible = true;
    Object.assign(p, { age: 0, life, grow, size, vy, alpha });
  }
  return {
    group,
    /** Short additive flash plus a smoke puff at the muzzle. */
    muzzleFlash(pos) {
      spawn({ pos, color: 0xffd890, additive: true, life: 0.12, size: 1.4, grow: 2 });
      spawn({ pos: pos.clone().add(new THREE.Vector3(0, 0.2, 0)), color: 0xd8d4cc, additive: false, life: 1.6, size: 0.8, grow: 1.6, vy: 0.6, alpha: 0.7 });
    },
    /** Dust puff of 6 seeded sprites at an impact point. */
    impactPuff(pos, color = 0x8a7a68) {
      for (let i = 0; i < 6; i++) {
        const j = new THREE.Vector3((rng() - 0.5) * 1.6, rng() * 0.8, (rng() - 0.5) * 1.6);
        spawn({ pos: pos.clone().add(j), color, additive: false, life: 1.5 + rng(), size: 1 + rng(), grow: 2.2, vy: 0.5 + rng() * 0.5, alpha: 0.85 });
      }
      spawn({ pos, color: 0xffb060, additive: true, life: 0.18, size: 2.2, grow: 3 });
    },
    /** Advance by dt seconds (fixed steps keep it deterministic). */
    update(dt) {
      for (const p of pool) {
        if (!p.sprite.visible) continue;
        p.age += dt;
        if (p.age >= p.life) { p.sprite.visible = false; continue; }
        const k = p.age / p.life;
        p.sprite.scale.setScalar(p.size * (1 + p.grow * k));
        p.sprite.position.y += p.vy * dt;
        p.sprite.material.opacity = p.alpha * (1 - k);
      }
    },
    active: () => pool.filter((p) => p.sprite.visible).length,
    dispose() { scene.remove(group); tex.dispose(); for (const p of pool) p.sprite.material.dispose(); },
  };
}

// src/render/fx.js - owns deterministic pooled muzzle flame, powder smoke, projectile wakes and expanding impact dust.
import * as THREE from "three";
import { createRng } from "../core/rng.js";

function softDisk(cloud = false, size = 64) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x + 0.5) / size - 0.5, dy = (y + 0.5) / size - 0.5;
    const noise = Math.sin(x * 0.36 + Math.sin(y * 0.21) * 2) * Math.sin(y * 0.31 + x * 0.13);
    const edge = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 2 + (cloud ? noise * 0.08 : 0));
    const a = cloud ? Math.pow(edge, 0.85) * (0.8 + noise * 0.18) : edge * edge;
    const i = (x + size * y) * 4;
    data[i] = data[i + 1] = data[i + 2] = cloud ? Math.round(230 + noise * 20) : 255;
    data[i + 3] = Math.round(255 * Math.min(1, a));
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.LinearFilter; t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
  return t;
}

/** All lifetimes advance through fixed sim dt; the pool never allocates a sprite during play. */
export function createFx({ scene, seed = 1, max = 160 }) {
  const rng = createRng(seed), tex = softDisk(true), glow = softDisk();
  const pool = [], emitter = new THREE.Vector3(), candidate = new THREE.Vector3();
  const group = new THREE.Group(); group.name = "fx"; scene.add(group);
  for (let i = 0; i < max; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: true }));
    s.visible = false; group.add(s);
    pool.push({ sprite: s, age: 0, life: 0, grow: 0, size: 0, vx: 0, vy: 0, vz: 0, alpha: 1 });
  }
  function spawn({ pos, color, additive = false, life, size, grow, vx = 0, vy = 0, vz = 0, alpha = 1 }) {
    const p = pool.find(q => !q.sprite.visible) ?? pool.reduce((a,b) => a.age / a.life > b.age / b.life ? a : b);
    const m = p.sprite.material;
    m.color.setHex(color); m.map = additive ? glow : tex;
    m.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    m.opacity = alpha; m.rotation = additive ? 0 : rng() * Math.PI * 2; m.needsUpdate = true;
    p.sprite.position.copy(pos); p.sprite.scale.setScalar(size); p.sprite.visible = true;
    Object.assign(p, { age: 0, life, grow, size, vx, vy, vz, alpha });
  }
  return {
    group,
    muzzleFlash(pos) {
      // Sim projectile origin belongs to collision geometry; emit at the visible barrel mouth.
      // The closest attachment within 3 m also supports independently positioned kit cannons.
      emitter.copy(pos); let nearest = 9;
      scene.updateMatrixWorld(true);
      scene.traverse(o => {
        if (o.name !== "Muzzle") return;
        o.getWorldPosition(candidate);
        const distance = candidate.distanceToSquared(pos);
        if (distance < nearest) { nearest = distance; emitter.copy(candidate); }
      });
      spawn({ pos: emitter, color: 0xffdd9d, additive: true, life: 0.10, size: 2.1, grow: 0.5 });
      spawn({ pos: emitter, color: 0xfff4d8, additive: true, life: 0.065, size: 1.15, grow: 0.3 });
      for (let i = 0; i < 7; i++) {
        const j = new THREE.Vector3((rng()-.5)*.6, rng()*.4, (rng()-.5)*.6);
        spawn({ pos: emitter.clone().add(j), color: 0xd9dad4, life: 1.8 + rng()*.6,
          size: .8 + rng()*.45, grow: 2.8, vx: (rng()-.5)*.5, vy: .5 + rng()*.45, vz: (rng()-.5)*.5, alpha: .65 });
      }
    },
    impactPuff(pos, color = 0xb0a18b) {
      for (let i = 0; i < 12; i++) {
        const angle = rng() * Math.PI * 2, speed = .8 + rng()*2;
        const j = new THREE.Vector3(Math.cos(angle)*.6, rng()*.8, Math.sin(angle)*.6);
        spawn({ pos: pos.clone().add(j), color, life: 2.2 + rng(), size: 1.4 + rng(), grow: 2.4,
          vx: Math.cos(angle)*speed, vy: .5 + rng(), vz: Math.sin(angle)*speed, alpha: .8 });
      }
      spawn({ pos, color: 0xffcf8b, additive: true, life: .10, size: 2.0, grow: 2 });
    },
    trail(pos) {
      spawn({ pos, color: 0xd3d6d2, life: 2.0, size: .9, grow: 1.5, vy: .25, alpha: .55 });
    },
    update(dt) {
      for (const p of pool) {
        if (!p.sprite.visible) continue;
        p.age += dt;
        if (p.age >= p.life) { p.sprite.visible = false; continue; }
        const k = p.age / p.life;
        p.sprite.scale.setScalar(p.size * (1 + p.grow * k));
        p.sprite.position.x += p.vx * dt; p.sprite.position.y += p.vy * dt; p.sprite.position.z += p.vz * dt;
        p.sprite.material.opacity = p.alpha * (1 - k) * (1 - k * .35);
      }
    },
    active: () => pool.filter(p => p.sprite.visible).length,
    dispose() { scene.remove(group); tex.dispose(); glow.dispose(); for (const p of pool) p.sprite.material.dispose(); },
  };
}

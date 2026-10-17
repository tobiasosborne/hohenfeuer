// src/render/people-view.js - owns NPC and ruler figures: one InstancedMesh of the kit person (role-tinted, facing its motion) plus instanced blob shadows (DESIGN 7.4).
import * as THREE from "three";

/** Tunic tints by role (DESIGN 7.4: crew red, runner yellow, mason grey, civilian brown; ruler gold). sRGB hex. */
export const ROLE_TINT = Object.freeze({ crew: 0xd04030, runner: 0xe0c040, mason: 0xa8a8a0, civilian: 0x9a6a40, ruler: 0xf0c040 });

function blobTexture(size = 64) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x + 0.5) / size - 0.5, dy = (y + 0.5) / size - 0.5;
    const a = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 2);
    data[(x + size * y) * 4 + 3] = Math.round(255 * a);
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}

/** First mesh of a model, baked into a standalone geometry in model space (feet at y = 0, front = -Z). */
function personGeometry(model) {
  let mesh = null;
  model.updateMatrixWorld(true);
  model.traverse((o) => { if (!mesh && o.isMesh) mesh = o; });
  if (!mesh) return null;
  return { geometry: mesh.geometry.clone().applyMatrix4(mesh.matrixWorld), material: mesh.material.clone() };
}

/**
 * The kit person paints tunic and cap red. Recolour only those texels with the per-instance role tint (instanceColor),
 * keeping the texel's shading; skin (g/r ~0.55) and dark trousers (r < 0.12) keep their texture colour.
 */
function tintTunic(material) {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `
      #if defined( USE_COLOR )
        float hfRed = diffuseColor.r;
        float hfMask = step(0.12, hfRed) * (1.0 - smoothstep(0.18, 0.32, diffuseColor.g / max(hfRed, 1e-3)));
        vec3 hfTint = vColor.rgb * clamp(hfRed * 2.5, 0.2, 1.2);
        diffuseColor.rgb = mix(diffuseColor.rgb, hfTint, hfMask);
      #endif`);
  };
  material.customProgramCacheKey = () => "hohenfeuer-people-tint";
}

/**
 * @param {object} o
 * @param {THREE.Object3D} o.scene
 * @param {THREE.Object3D|null} [o.model] kit person (e.g. assets/kit-v1/person.glb); a box figure if absent
 * @param {number} [o.max] instance capacity
 */
export function createPeopleView({ scene, model = null, max = 256 }) {
  const baked = model ? personGeometry(model) : null;
  const geometry = baked ? baked.geometry : new THREE.BoxGeometry(0.5, 1.75, 0.3).translate(0, 0.875, 0);
  const material = baked ? baked.material : new THREE.MeshLambertMaterial({ color: 0xffffff });
  if (baked) tintTunic(material);
  const bodies = new THREE.InstancedMesh(geometry, material, max);
  bodies.name = "people";
  bodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bodies.setColorAt(0, new THREE.Color(1, 1, 1));
  bodies.count = 0;
  bodies.frustumCulled = false;
  const shadowTex = blobTexture();
  const shadows = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x000000, map: shadowTex, transparent: true, opacity: 0.45, depthWrite: false }),
    max,
  );
  shadows.name = "people-shadows";
  shadows.count = 0;
  shadows.frustumCulled = false;
  scene.add(bodies, shadows);

  const facing = new Map(); // id -> three rotation.y, kept while standing still
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  const pos = new THREE.Vector3(), col = new THREE.Color();
  return {
    bodies, shadows,
    /**
     * @param {Array<{id: number, pos: number[], prev?: {x: number, y: number, z: number}, now?: {x: number, y: number, z: number},
     *   role: string, tint?: number}>} people live people with interpolated feet positions; prev/now give the heading
     */
    update(people) {
      const n = Math.min(max, people.length);
      for (let i = 0; i < n; i++) {
        const p = people[i];
        if (p.prev && p.now) {
          const dx = p.now.x - p.prev.x, dz = p.now.z - p.prev.z;
          if (dx * dx + dz * dz > 1e-8) facing.set(p.id, -Math.atan2(dx, -dz));
        }
        q.setFromAxisAngle(up, facing.get(p.id) ?? 0);
        pos.set(p.pos[0], p.pos[1], p.pos[2]);
        m.compose(pos, q, one);
        bodies.setMatrixAt(i, m);
        bodies.setColorAt(i, col.setHex(p.tint ?? ROLE_TINT[p.role] ?? 0xffffff));
        pos.y += 0.03;
        m.compose(pos, q.identity(), one);
        shadows.setMatrixAt(i, m);
      }
      bodies.count = n; shadows.count = n;
      bodies.instanceMatrix.needsUpdate = true;
      if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
      shadows.instanceMatrix.needsUpdate = true;
      return n;
    },
    dispose() { scene.remove(bodies, shadows); geometry.dispose(); material.dispose(); shadows.geometry.dispose(); shadows.material.dispose(); shadowTex.dispose(); },
  };
}

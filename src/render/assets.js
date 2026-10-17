// src/render/assets.js - owns cached loading of GLB, textures and JSON, and conversion of block-kit GLBs into mesher block models.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { modelFromTriangles } from "./mesher.js";
import { gradeBlockAtlas } from "./block-palette.js";

/** Convert the first mesh of a kit block GLB (centred on x/z, y 0..1) into a block model. */
export function blockModelFromGltf(gltf) {
  let mesh = null;
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => { if (!mesh && o.isMesh) mesh = o; });
  if (!mesh) return null;
  const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  const P = g.getAttribute("position"), N = g.getAttribute("normal"), U = g.getAttribute("uv"), Cc = g.getAttribute("color");
  const flat = (a, n) => { const out = new Float32Array(a.count * n); for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) out[i * n + k] = a.getComponent(i, k); return out; };
  return modelFromTriangles({
    positions: flat(P, 3), normals: N ? flat(N, 3) : undefined, uvs: U ? flat(U, 2) : undefined,
    colors: Cc ? flat(Cc, Cc.itemSize) : undefined, colorSize: Cc ? Cc.itemSize : 3,
    indices: g.index ? Array.from(g.index.array) : undefined,
  }, { offset: [0.5, 0, 0.5] });
}

/** Replace glTF PBR/unlit materials by Lambert with the same map and vertex colours (DESIGN 7.2 look). */
export function lambertize(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const old = o.material;
    o.material = new THREE.MeshLambertMaterial({ map: old.map ?? null, vertexColors: !!o.geometry.getAttribute("color"), name: old.name });
    old.dispose();
  });
  return root;
}

/**
 * three r186's GLTFLoader reads node `extras.pivot` as a GLTFExporter pivot array. Kit v1 uses `extras.pivot` as a
 * descriptive string (cannon Pitch: "trunnion centre; ..."), which the loader turns into a NaN position. Undo that:
 * restore the node's and its first child's glTF translations and clear `pivot`.
 */
export function repairStringPivots(gltf) {
  const defs = gltf.parser?.json?.nodes ?? [];
  const objects = new Map();
  for (const [object, assoc] of gltf.parser?.associations ?? []) if (assoc && assoc.nodes !== undefined && object.isObject3D) objects.set(assoc.nodes, object);
  defs.forEach((def, i) => {
    const pivot = def.extras?.pivot;
    if (pivot === undefined || Array.isArray(pivot)) return;
    const node = objects.get(i);
    if (!node) return;
    node.pivot = null;
    node.position.fromArray(def.translation ?? [0, 0, 0]);
    node.userData.pivot = pivot;
    const firstChild = def.children?.[0];
    if (firstChild !== undefined && objects.get(firstChild)) objects.get(firstChild).position.fromArray(defs[firstChild].translation ?? [0, 0, 0]);
  });
  return gltf;
}

export function createAssets() {
  const cache = new Map();
  const gltf = new GLTFLoader();
  const tex = new THREE.TextureLoader();
  const once = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };
  const api = {
    loadGLB: (url) => once(`glb:${url}`, () => gltf.loadAsync(url).then(repairStringPivots)),
    loadJSON: (url) => once(`json:${url}`, async () => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`assets: ${url} -> HTTP ${r.status}`);
      return r.json();
    }),
    /** Texture for glTF-style UVs (flipY false), sRGB, bilinear with mipmaps, anisotropy 1 (DESIGN 7.2). */
    loadTexture: (url, { flipY = false } = {}) => once(`tex:${url}:${flipY}`, async () => {
      const t = await tex.loadAsync(url);
      t.flipY = flipY;
      t.colorSpace = THREE.SRGBColorSpace;
      t.magFilter = THREE.LinearFilter;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.anisotropy = 1;
      t.generateMipmaps = true;
      t.needsUpdate = true;
      return t;
    }),
    /**
     * Load a block kit directory with manifest.json {atlas: {file}, blocks: [{id, key, mesh, damage_variants?}],
     * weapons?: [{key, mesh}], people?: [{key, mesh}]}. Variants are the kit's _z1.._z3 meshes per damage state.
     * @returns {Promise<{models: Array<object|null>, variants: Array<Array<object|null>|undefined>, atlas: THREE.Texture,
     *   manifest: object, weapons: Object<string, THREE.Object3D>, people: Object<string, THREE.Object3D>}>}
     */
    async loadBlockKit(dir) {
      const manifest = await api.loadJSON(`${dir}manifest.json`);
      const models = new Array(256).fill(null);
      const variants = [];
      const weapons = {}, people = {};
      const jobs = manifest.blocks.filter((b) => b.id !== 0 && b.mesh).map(async (b) => {
        models[b.id] = blockModelFromGltf(await api.loadGLB(`${dir}${b.mesh}`));
        if (Array.isArray(b.damage_variants)) {
          variants[b.id] = await Promise.all(b.damage_variants.map(async (m) => blockModelFromGltf(await api.loadGLB(`${dir}${m}`))));
        }
      });
      for (const w of manifest.weapons ?? []) jobs.push(api.loadGLB(`${dir}${w.mesh}`).then((g) => {
        g.scene.userData.weaponId = w.key;
        weapons[w.key] = lambertize(g.scene);
      }));
      for (const h of manifest.people ?? []) jobs.push(api.loadGLB(`${dir}${h.mesh}`).then((g) => { people[h.key] = lambertize(g.scene); }));
      const [atlas] = await Promise.all([api.loadTexture(`${dir}${manifest.atlas.file}`), ...jobs]);
      gradeBlockAtlas(atlas, manifest);
      atlas.userData.blockManifest = manifest;
      return { models, variants, atlas, manifest, weapons, people };
    },
  };
  return api;
}

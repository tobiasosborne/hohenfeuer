// src/render/harness.js - owns booting the render-only harness (dev/render.html): test grid, kit or fallback blocks, terrain, sky, cannons, debug hook.
import * as THREE from "three";
import { createRenderer } from "./renderer.js";
import { createSky } from "./sky.js";
import { createTerrainView } from "./terrain-view.js";
import { createChunkManager } from "./chunks.js";
import { createModelSet, fallbackModels } from "./mesher.js";
import { createWeaponView } from "./weapon-view.js";
import { createFx } from "./fx.js";
import { createAssets } from "./assets.js";
import { installDebugApi } from "./debug-api.js";
import { buildTestScene, TEST_SCENE } from "./test-scene.js";

export const KIT_DIR = "/assets/kit-v0/";
export const DEFAULT_POSE = Object.freeze({ position: [109.5, 12.6, 118.5], yaw: -1.62, pitch: -0.06, fov: 60 });

/**
 * Boot the harness into document.body. URL params: kit=0 forces the fallback palette.
 * @returns {Promise<object>} the debug hook
 */
export async function bootRenderHarness({ params = new URLSearchParams(globalThis.location?.search ?? "") } = {}) {
  const test = buildTestScene();
  const view = createRenderer({ biome: "forest", sunDir: test.sunDir });
  globalThis.document.body.appendChild(view.domElement);

  const sky = createSky({ seed: TEST_SCENE.seed });
  view.scene.add(sky.mesh);
  view.onBeforeRender((cam) => sky.follow(cam));

  const terrain = createTerrainView({ map: test.terrainMap, seed: TEST_SCENE.seed, biome: "forest" });
  view.scene.add(terrain.group);

  const assets = createAssets();
  let models = null, material = null, kit = "fallback", kitError = null;
  if (params.get("kit") !== "0") {
    try {
      const k = await assets.loadBlockKit(KIT_DIR);
      models = k.models;
      material = new THREE.MeshLambertMaterial({ map: k.atlas, vertexColors: true });
      kit = "kit-v0";
    } catch (e) {
      kitError = String(e);
    }
  }
  if (!models) {
    models = fallbackModels();
    material = new THREE.MeshLambertMaterial({ vertexColors: true });
  }
  const chunks = createChunkManager({ models: createModelSet(models), material, meshOpts: { sunDir: test.sunDir } });
  for (const p of test.plots) chunks.addPlot(p);
  chunks.flush();
  view.scene.add(chunks.group);

  const cannons = test.cannons.map((c) => {
    const p = test.plots[c.plot];
    const w = createWeaponView();
    w.root.position.set(p.origin.x + c.cell[0] + 0.5, p.origin.y + c.cell[1], p.origin.z + c.cell[2] + 0.5);
    w.setAim(c.azDeg, 2);
    view.scene.add(w.root);
    return w;
  });

  const fx = createFx({ scene: view.scene, seed: TEST_SCENE.seed });

  const api = installDebugApi({
    view,
    extras: { kit, kitError, chunks, cannons, fx, terrain, test, three: THREE },
  });
  api.setPose(DEFAULT_POSE);

  const loop = () => {
    chunks.update(view.camera.position);
    view.render();
    globalThis.requestAnimationFrame(loop);
  };
  globalThis.requestAnimationFrame(loop);
  api.ready = true;
  return api;
}

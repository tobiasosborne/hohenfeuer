// src/render/weapon-view.js - owns weapon models: Base/Yaw/Pitch/Muzzle/Sight node tree, aim posing and the weapon-view camera (DESIGN 7.4, 5).
import * as THREE from "three";
import { TUNING } from "../tuning.js";

const DEG = Math.PI / 180;
const NODE_NAMES = ["Base", "Yaw", "Pitch", "Muzzle", "Sight"];
/** Sight offset of the placeholder cannon from its yaw pivot [x, up, back] in metres. */
export const PLACEHOLDER_SIGHT = Object.freeze([0, TUNING.ruler.sightUpM, TUNING.ruler.sightBackM]);

/** Placeholder cannon (frame / turntable / barrel), built in code until a kit GLB with the node tree exists. */
function placeholderCannon() {
  const wood = new THREE.MeshLambertMaterial({ color: 0x6a4428 });
  const iron = new THREE.MeshLambertMaterial({ color: 0x3c3c40 });
  const base = new THREE.Group(); base.name = "Base";
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.9), wood);
  plate.position.y = 0.03;
  base.add(plate);
  const yaw = new THREE.Group(); yaw.name = "Yaw"; yaw.position.y = 0.06;
  base.add(yaw);
  // frame cheeks (Gestell) merged into one geometry: one draw call
  const cheekL = new THREE.BoxGeometry(0.12, 0.5, 0.9).translate(-0.28, 0.25, 0.05);
  const cheekR = new THREE.BoxGeometry(0.12, 0.5, 0.9).translate(0.28, 0.25, 0.05);
  const table = new THREE.CylinderGeometry(0.42, 0.42, 0.06, 16).translate(0, 0.0, 0);
  const frame = new THREE.Mesh(mergeGeometries([cheekL, cheekR, table]), wood);
  yaw.add(frame);
  const pitch = new THREE.Group(); pitch.name = "Pitch"; pitch.position.y = 0.5;
  yaw.add(pitch);
  const barrelGeo = new THREE.CylinderGeometry(0.13, 0.19, 1.6, 14).rotateX(-Math.PI / 2).translate(0, 0, -0.45);
  const breech = new THREE.SphereGeometry(0.11, 10, 8).translate(0, 0, 0.4);
  const trunnion = new THREE.CylinderGeometry(0.05, 0.05, 0.62, 8).rotateZ(Math.PI / 2);
  pitch.add(new THREE.Mesh(mergeGeometries([barrelGeo, breech, trunnion]), iron));
  const muzzle = new THREE.Object3D(); muzzle.name = "Muzzle"; muzzle.position.set(0, 0, -1.25);
  pitch.add(muzzle);
  // Sight per TUNING.ruler.sightUpM / sightBackM (1.25 / 2.0 since 2026-10-17) so the barrel sits low in frame (shot 04).
  const sight = new THREE.Object3D(); sight.name = "Sight";
  sight.position.set(0, PLACEHOLDER_SIGHT[1], PLACEHOLDER_SIGHT[2]);
  yaw.add(sight);
  return base;
}

/** Minimal non-indexed merge of position/normal geometries (avoids pulling BufferGeometryUtils). */
function mergeGeometries(geos) {
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const n = parts.reduce((s, g) => s + g.getAttribute("position").count, 0);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of parts) {
    pos.set(g.getAttribute("position").array, o * 3);
    nor.set(g.getAttribute("normal").array, o * 3);
    o += g.getAttribute("position").count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  return out;
}

/**
 * @param {object} [o]
 * @param {THREE.Object3D} [o.model] a GLB scene with nodes Base/Yaw/Pitch/Muzzle/Sight; placeholder cannon if absent
 */
export function createWeaponView({ model } = {}) {
  const root = model ?? placeholderCannon();
  const nodes = {};
  for (const name of NODE_NAMES) nodes[name.toLowerCase()] = root.name === name ? root : root.getObjectByName(name);
  for (const k of ["yaw", "pitch", "muzzle", "sight"]) if (!nodes[k]) throw new Error(`weapon-view: model lacks node "${k}"`);
  const state = { azDeg: 0, elevDeg: 0 };
  const tmp = new THREE.Vector3();
  return {
    root, nodes, state,
    /** Azimuth clockwise from north (000 = -Z), elevation up in degrees. */
    setAim(azDeg, elevDeg) {
      state.azDeg = azDeg; state.elevDeg = elevDeg;
      nodes.yaw.rotation.y = -azDeg * DEG;
      nodes.pitch.rotation.x = elevDeg * DEG;
      root.updateMatrixWorld(true);
    },
    /** Put a camera at the Sight node looking along the weapon azimuth (weapon view, DESIGN 5). */
    applySight(camera, { fovDeg = TUNING.ruler.weaponFovDeg, pitchDeg = -2 } = {}) {
      root.updateMatrixWorld(true);
      nodes.sight.getWorldPosition(tmp);
      camera.position.copy(tmp);
      camera.rotation.set(pitchDeg * DEG, -state.azDeg * DEG, 0, "YXZ");
      camera.fov = fovDeg;
      camera.updateProjectionMatrix();
    },
    muzzleWorld(out = new THREE.Vector3()) { return nodes.muzzle.getWorldPosition(out); },
    dispose() { root.traverse((ob) => { if (ob.isMesh) { ob.geometry.dispose(); ob.material.dispose(); } }); },
  };
}

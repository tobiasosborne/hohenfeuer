// Owns render-environment regression checks for colour encoding, continuous terrain UVs and fixed-step effects.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { createSky } from '../src/render/sky.js';
import { createTerrainView } from '../src/render/terrain-view.js';
import { createFx } from '../src/render/fx.js';
import { createWeaponView } from '../src/render/weapon-view.js';
import { TUNING } from '../src/tuning.js';

test('sky stores requested sRGB endpoints without a second linear-to-sRGB interpretation', () => {
  const sky = createSky({ horizon: 0x8090a0, zenith: 0x304060, cover: 0 });
  const { data, width, height } = sky.mesh.material.map.image;
  assert.deepEqual([...data.slice(0, 3)], [128, 144, 160]);
  assert.deepEqual([...data.slice((height - 1) * width * 4, (height - 1) * width * 4 + 3)], [48, 64, 96]);
  sky.dispose();
});

test('terrain grain tiles continuously between the heightfield and horizon skirt', () => {
  const field = { width: 2, depth: 2, spacing: 2, origin: { x: 12, z: 24 }, heights: [0, 0, 0, 0], plots: [] };
  const terrain = createTerrainView({ field, seed: 7 });
  const land = terrain.group.getObjectByName('terrain-field');
  const skirt = terrain.group.getObjectByName('terrain-skirt');
  assert.ok(land.material.map, 'terrain needs painted grain at walking distance');
  assert.equal(land.material.map, skirt.material.map, 'one texture across the horizon transition');
  assert.equal(land.material.map.wrapS, THREE.RepeatWrapping);
  const uv = land.geometry.getAttribute('uv');
  assert.ok(uv && uv.getX(1) > uv.getX(0) && uv.getY(2) > uv.getY(0));
  assert.ok([...land.material.map.image.data].every(Number.isFinite));
  terrain.dispose();
});

test('weapon sight uses the design pitch by default', () => {
  const gun = createWeaponView();
  const camera = new THREE.PerspectiveCamera();
  gun.applySight(camera);
  assert.equal(camera.rotation.x, TUNING.ruler.weaponViewPitchDeg * Math.PI / 180);
  gun.dispose();
});

test('effect pools remain deterministic, bounded, and retire all particles', () => {
  const run = () => {
    const fx = createFx({ scene: new THREE.Scene(), seed: 13, max: 32 });
    const at = new THREE.Vector3(0, 1, 0);
    fx.muzzleFlash(at); fx.impactPuff(at);
    for (let i = 0; i < 60; i++) { fx.trail(at); fx.update(1 / 30); }
    assert.ok(fx.active() <= 32);
    const snapshot = fx.group.children.filter(s => s.visible).map(s => [...s.position, ...s.scale, s.material.opacity]);
    for (let i = 0; i < 300; i++) fx.update(1 / 30);
    assert.equal(fx.active(), 0);
    fx.dispose();
    return snapshot;
  };
  assert.deepEqual(run(), run());
});

test('muzzle emission resolves the nearby rendered attachment instead of the sim collision origin', () => {
  const scene = new THREE.Scene(), muzzle = new THREE.Object3D();
  muzzle.name = 'Muzzle'; muzzle.position.set(0, 2, -1.5); scene.add(muzzle);
  const fx = createFx({ scene });
  fx.muzzleFlash(new THREE.Vector3(0, 1, -0.5));
  const flash = fx.group.children.find(s => s.visible && s.material.blending === THREE.AdditiveBlending);
  assert.ok(flash.position.distanceTo(muzzle.position) < 0.01, 'flash must be outside the barrel');
  fx.dispose();
});

test('forest props are repeatable and leave castle plot skirts clear', () => {
  const field = { width: 33, depth: 33, spacing: 4, origin: {x: 0, z: 0}, heights: new Float32Array(1089),
    plots: [{ origin: [16,0,16], width: 48, depth: 48 }] };
  const a = createTerrainView({ field, seed: 17 }), b = createTerrainView({ field, seed: 17 });
  const trees = a.group.getObjectByName('forest-trees'), other = b.group.getObjectByName('forest-trees');
  assert.ok(trees?.isInstancedMesh && trees.count > 0);
  assert.deepEqual(trees.instanceMatrix.array, other.instanceMatrix.array);
  const matrix = new THREE.Matrix4(), pos = new THREE.Vector3();
  for (let i = 0; i < trees.count; i++) {
    trees.getMatrixAt(i, matrix); pos.setFromMatrixPosition(matrix);
    assert.ok(pos.x <= 4 || pos.x >= 76 || pos.z <= 4 || pos.z >= 76, 'tree overlaps a castle skirt');
  }
  assert.ok(field.heights.every(y => y === 0), 'cosmetic props never alter collision heights');
  a.dispose(); b.dispose();
});

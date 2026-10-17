// Owns style selection, material semantics and geometry-preserving switch regression tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { STYLES, resolveStyle, readStyle, gpuExtrasEnabled } from '../../src/render/styles.js';
import { createBlockMaterial, createTerrainMaterial, createSkyMaterial, createFireMaterial, createWaterView, atlasStyleData } from '../../src/render/modern-materials.js';
import { createStyleController } from '../../src/render/style-scene.js';
import { TUNING } from '../../src/tuning.js';

test('classic default; period reserved; storage ignored by goldens; URL wins', () => {
  assert.deepEqual(Object.keys(STYLES), ['classic', 'modern']);
  assert.equal(resolveStyle().name, 'classic');
  assert.equal(resolveStyle('period').name, 'classic');
  const storage = { getItem: () => '{"style":"modern"}' };
  assert.equal(readStyle(new URLSearchParams(), storage), 'modern');
  assert.equal(readStyle(new URLSearchParams('golden=1'), storage), 'classic');
  assert.equal(readStyle(new URLSearchParams('golden=1&style=modern'), storage), 'modern');
  assert.equal(readStyle(new URLSearchParams('style=classic'), storage), 'classic');
  assert.equal(readStyle(new URLSearchParams(), { getItem() { throw Error(); } }), 'classic');
  assert.equal(TUNING.render.gpuExtras, false);
  assert.equal(gpuExtrasEnabled({style:'modern', requested:true, golden:true}), false);
  assert.equal(gpuExtrasEnabled({style:'classic', requested:true}), false);
  assert.equal(gpuExtrasEnabled({style:'modern', requested:true}), true);
});

test('atlas damage lookup matches top-origin glTF UVs; stone has no specular', () => {
  const manifest = {atlas:{size_px:64,tile_px:16,gutter_px:1},blocks:[{key:'stone',atlas_tiles:[0],damage_atlas_tiles:[[1],[2],[3]]}]};
  const lookup = atlasStyleData(manifest);
  assert.deepEqual([0,1,2,3].map(i=>lookup.image.data[(12+i)*4]), [0,85,170,255]);
  assert.ok([0,1,2,3].every(i=>lookup.image.data[(12+i)*4+1]===0));
  const mat = createBlockMaterial({manifest});
  assert.ok(mat.isShaderMaterial && mat.vertexColors);
  assert.equal(mat.uniforms.uSpecular.value, 0);
  assert.match(mat.fragmentShader, /uAtlasState/);
  assert.match(mat.fragmentShader, /vBaked/);
  assert.match(mat.fragmentShader, /heightFog/);
  lookup.dispose(); mat.dispose();
});

test('modern materials are node-constructible; dry terrain adds no water', () => {
  for (const make of [createTerrainMaterial,createSkyMaterial,createFireMaterial]) {
    const m = make(); assert.ok(m.isShaderMaterial); assert.ok(!/Date|performance|Math.random/.test(m.fragmentShader)); m.dispose();
  }
  const water=createWaterView({}); assert.equal(water.group.children.length,0); assert.equal(water.supported,false); water.dispose();
});

test('switch replaces materials, preserves geometry and restores exact classic objects', () => {
  const scene=new THREE.Scene(), original=new THREE.MeshLambertMaterial({vertexColors:true});
  const geometry=new THREE.BoxGeometry(), mesh=new THREE.Mesh(geometry, original); mesh.name='chunk 0:0:0:0'; scene.add(mesh);
  const controller=createStyleController({scene});
  controller.setStyle('modern'); controller.update({tick:30});
  assert.equal(mesh.geometry,geometry); assert.ok(mesh.material.isShaderMaterial); assert.notEqual(mesh.material,original);
  const late=new THREE.Mesh(geometry,original); late.name='chunk 0:1:0:0'; scene.add(late); controller.update({tick:30});
  assert.equal(late.material,mesh.material);
  controller.setStyle('classic'); assert.equal(mesh.material,original); assert.equal(late.material,original); assert.equal(mesh.geometry,geometry);
  assert.throws(()=>controller.setStyle('period'),/Unknown/); controller.dispose(); geometry.dispose(); original.dispose();
});

test('switch disposes modern materials without disposing shared classic atlas or geometry', () => {
  const scene=new THREE.Scene(), atlas=new THREE.Texture(), original=new THREE.MeshLambertMaterial({map:atlas});
  const geometry=new THREE.BoxGeometry(), mesh=new THREE.Mesh(geometry,original);mesh.name='chunk fixture';scene.add(mesh);
  let atlasDisposed=0,geometryDisposed=0,materialDisposed=0;
  atlas.addEventListener('dispose',()=>atlasDisposed++);geometry.addEventListener('dispose',()=>geometryDisposed++);
  const c=createStyleController({scene});c.setStyle('modern');mesh.material.addEventListener('dispose',()=>materialDisposed++);
  c.setStyle('classic');assert.equal(materialDisposed,1);assert.equal(atlasDisposed,0);assert.equal(geometryDisposed,0);
  c.setStyle('modern');assert.ok(mesh.material.isShaderMaterial);c.dispose();assert.equal(mesh.material,original);
  atlas.dispose();geometry.dispose();original.dispose();
});

test('fire instances obey the fixed cap, cell positions and explicit tick including rewind', async () => {
  const {META}=await import('../../src/contracts.js');
  const scene=new THREE.Scene(), c=createStyleController({scene});c.setStyle('modern');
  const n=TUNING.render.modern.fireMax+1;
  const state={tick:90,castles:[{plot:{width:n,depth:1,origin:{x:10,y:2,z:30},type:new Uint8Array(n).fill(4),hp:new Uint8Array(n).fill(10),meta:new Uint8Array(n).fill(META.BURNING_BIT)}}]};
  c.update(state);const fire=scene.getObjectByName('modern-burning-blocks');assert.equal(fire.count,TUNING.render.modern.fireMax);
  assert.equal(fire.material.uniforms.uTime.value,3);const m=new THREE.Matrix4();fire.getMatrixAt(0,m);
  assert.equal(m.elements[12],10.5);assert.equal(m.elements[14],30.5);
  state.tick=0;c.update(state);assert.equal(fire.material.uniforms.uTime.value,0);
  state.tick=1;state.castles[0].plot.meta.fill(0);c.update(state);assert.equal(fire.count,0);assert.equal(fire.visible,false);c.dispose();
});

test('all authored stone damage GLBs address the matching LUT quartile', async () => {
  const {readFile}=await import('node:fs/promises');
  const manifest=JSON.parse(await readFile(new URL('../../assets/kit-v1/manifest.json',import.meta.url),'utf8'));
  const stone=manifest.blocks.find(b=>b.key==='stone'), lut=atlasStyleData(manifest), columns=lut.image.width;
  for(const [state,file] of [stone.mesh,...stone.damage_variants].entries()) {
    const bytes=await readFile(new URL(`../../assets/kit-v1/${file}`,import.meta.url));
    const jsonBytes=bytes.readUInt32LE(12), gltf=JSON.parse(bytes.subarray(20,20+jsonBytes).toString());
    const binary=20+jsonBytes+8;
    for(const mesh of gltf.meshes)for(const primitive of mesh.primitives) {
      const accessor=gltf.accessors[primitive.attributes.TEXCOORD_0], view=gltf.bufferViews[accessor.bufferView];
      assert.equal(accessor.componentType,5126);
      for(let i=0;i<accessor.count;i++) {
        const offset=binary+(view.byteOffset??0)+(accessor.byteOffset??0)+i*(view.byteStride??8);
        const u=bytes.readFloatLE(offset),v=bytes.readFloatLE(offset+4);
        const tile=Math.floor(u*columns)+Math.floor(v*columns)*columns;
        assert.equal(lut.image.data[tile*4],state*85,`${file} vertex ${i} damage state`);
      }
    }
  }
  lut.dispose();
});

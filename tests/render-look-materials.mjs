// Owns palette grading and effect regressions for look-loop pass 2.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { gradeBlockPixels } from '../src/render/block-palette.js';
import { createFx } from '../src/render/fx.js';
import { createWeaponView } from '../src/render/weapon-view.js';
import { weaponPose } from '../src/player/camera.js';

test('stone face contrast increases without brightening mortar, timber or empty tiles',()=>{
  const data = new Uint8ClampedArray([126,124,113,255,68,63,53,255,118,78,43,255,153,65,43,255]);
  const manifest={atlas:{tile_px:1},blocks:[{key:'tower',atlas_tiles:[0,1,2]},{key:'roof',atlas_tiles:[3]}]};
  gradeBlockPixels(data,4,manifest);
  assert.ok(data[0]>170 && data[1]>160,'warm faces must brighten');
  assert.ok(data[4]<68 && data[5]<63,'mortar must stay dark');
  assert.deepEqual([...data.slice(8,12)],[118,78,43,255],'timber is not stone');
  assert.ok(data[12]>153 && data[13]<=65,'roof should read redder');
  const plain=new Uint8ClampedArray([126,124,113,255]);
  gradeBlockPixels(plain,1,{atlas:{tile_px:1},blocks:[{key:'stone',atlas_tiles:[0]}]});
  assert.ok(plain[0]>126 && plain[0]<data[0],'sunlit plain walls receive less lift than shaded tower skins');
});

test('renderer sight and gameplay pivot agree through all cardinal yaws',()=>{
  const gun=createWeaponView(), camera=new THREE.PerspectiveCamera();
  gun.root.position.set(7,8,9);
  for(const azDeg of [0,90,180,270]) {
    gun.setAim(azDeg,21.27);gun.applySight(camera);
    const p=weaponPose({pivot:[7,8,9],azDeg});
    assert.ok(camera.position.distanceTo(new THREE.Vector3(...p.pos))<1e-9);
    assert.equal(camera.rotation.x,p.pitch);
  }
  gun.dispose();
});

test('incoming weapon models keep their authored sight even when a mesh is named barrel',()=>{
  const fixture=createWeaponView();
  fixture.root.userData.weaponId='double-cannon';
  fixture.nodes.sight.position.set(8,9,10);
  fixture.nodes.pitch.children[0].name='barrel';
  const view=createWeaponView({model:fixture.root});
  assert.deepEqual(view.nodes.sight.position.toArray(),[8,9,10]);
  view.dispose();
});

test('impact debris is pooled, ballistic and gone after the dust clears',()=>{
  const fx=createFx({scene:new THREE.Scene(),seed:5,max:32});
  fx.impactPuff(new THREE.Vector3(0,8,0));
  const debris=fx.group.getObjectByName('impact-debris');
  assert.ok(debris?.isInstancedMesh && debris.count>0,'one instanced debris draw');
  const a=new THREE.Matrix4(),b=new THREE.Matrix4();
  debris.getMatrixAt(0,a);fx.update(.2);debris.getMatrixAt(0,b);
  assert.notDeepEqual(a.elements,b.elements);
  for(let i=0;i<120;i++)fx.update(1/30);
  assert.equal(debris.count,0);assert.equal(fx.active(),0);fx.dispose();
});

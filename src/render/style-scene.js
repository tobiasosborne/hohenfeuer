// Owns reversible scene material bindings and the bounded sim-tick-driven burning-block view.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { K, META } from '../contracts.js';
import { TUNING } from '../tuning.js';
import { STYLES } from './styles.js';
import { createBlockMaterial, createTerrainMaterial, createSkyMaterial, createFireMaterial } from './modern-materials.js';

export function createStyleController({scene, sunDir}={}) {
  let style='classic', lastTick=-1, fire=null;
  const originals=new WeakMap(), cache=new Map(), materials=new Set();
  const pose=new THREE.Object3D();
  function kindOf(o) {
    if(o.name==='sky')return 'sky';
    if(o.name.startsWith('chunk '))return 'block';
    if(o.name==='terrain-field'||o.name==='terrain-skirt')return 'terrain';
    if(o.userData.modernWeapon)return 'weapon';
    if(o.name.startsWith('forest-'))return 'prop';
    return null;
  }
  function bind(o) {
    if(!o.isMesh || Array.isArray(o.material))return;
    const kind=kindOf(o); if(!kind)return;
    let record=originals.get(o);
    if(!record) { record={material:o.material,cast:o.castShadow,receive:o.receiveShadow}; originals.set(o,record); }
    const original=record.material;
    let byKind=cache.get(original);
    if(!byKind){byKind=new Map();cache.set(original,byKind);}
    let material=byKind.get(kind);
    if(!material) {
      if(kind==='sky')material=createSkyMaterial({sunDir});
      else if(kind==='terrain')material=createTerrainMaterial({field:o.parent.userData.terrainField,map:original.map,sunDir});
      else material=createBlockMaterial({map:original.map,color:original.color,vertexColors:original.vertexColors,iron:kind==='weapon',sunDir});
      material.side = original.side;
      byKind.set(kind,material);materials.add(material);
    }
    o.material=material;
  }
  function restore(o) {
    const record=originals.get(o); if(!record)return;
    o.material=record.material;o.castShadow=record.cast;o.receiveShadow=record.receive;
  }
  function makeFire() {
    const a=new THREE.PlaneGeometry(1.2,1.8).translate(0,.8,0),b=a.clone().rotateY(Math.PI/2);
    const geometry=mergeGeometries([a,b]);a.dispose();b.dispose();
    fire=new THREE.InstancedMesh(geometry,createFireMaterial(),TUNING.render.modern.fireMax);
    fire.name='modern-burning-blocks';fire.count=0;fire.visible=false;fire.frustumCulled=false;
    scene.add(fire);
  }
  function updateFire(state) {
    if(!fire)makeFire();
    fire.material.uniforms.uTime.value=(state?.tick??0)/K.TICK_HZ;
    if(lastTick===(state?.tick??0))return;
    lastTick=state?.tick??0;
    let count=0;
    for(const castle of state?.castles??[]) {
      const p=castle.plot;if(!p?.meta)continue;
      // Snapshot plot meta is public SimView data. No private sim hooks or random stream consumption.
      for(let i=0;i<p.meta.length && count<TUNING.render.modern.fireMax;i++) {
        if(!(p.meta[i]&META.BURNING_BIT)||!p.type[i]||p.hp[i]===0)continue;
        const y=Math.floor(i/(p.width*p.depth)), z=Math.floor(i/p.width)%p.depth, x=i%p.width;
        pose.position.set(p.origin.x+x+.5,p.origin.y+y+.45,p.origin.z+z+.5);pose.updateMatrix();
        fire.setMatrixAt(count++,pose.matrix);
      }
    }
    fire.count=count;fire.visible=count>0;fire.instanceMatrix.needsUpdate=true;
  }
  const api={
    get style(){return style;},
    setStyle(name) {
      if(!Object.hasOwn(STYLES,name))throw Error(`Unknown render style: ${name}`);
      if(style===name)return style;
      scene.traverse(restore);
      for(const m of materials)m.dispose();materials.clear();cache.clear();
      if(fire){fire.removeFromParent();fire.geometry.dispose();fire.material.dispose();fire=null;}
      lastTick=-1;style=name;
      if(style==='modern')scene.traverse(bind);
      return style;
    },
    update(state) {
      if(style!=='modern')return;
      scene.traverse(bind); // catches newly remeshed chunks; never reads or changes their geometry
      const seconds=(state?.tick??0)/K.TICK_HZ;
      for(const m of materials)if(m.uniforms.uTime)m.uniforms.uTime.value=seconds;
      updateFire(state);
    },
    dispose(){api.setStyle('classic');},
  };
  return api;
}

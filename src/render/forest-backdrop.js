// src/render/forest-backdrop.js - owns cosmetic seeded conifers and distant rock ridges, with no sim/collision data.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createRng } from "../core/rng.js";

// Seeded greyscale paint supplies needle clumps or fractured stone without sampling reference art.
function paint(seed, rock = false) {
  const size = 128, rng = createRng(seed), data = new Uint8Array(size*size*4);
  for (let y=0; y<size; y++) for (let x=0; x<size; x++) {
    const wave = Math.sin(x*.23+Math.sin(y*.18)*3) * Math.sin(y*.31+x*.11);
    const seam = rock ? Math.pow(Math.abs(Math.sin(x*.17+y*.08+Math.sin(y*.14)*2)),18) : Math.pow(Math.abs(Math.sin(y*.25+Math.sin(x*.15)*2)),8);
    const value = Math.max(70,Math.min(255,194 + wave*26 + rng()*30 - seam*62));
    const i=(x+y*size)*4; data[i]=data[i+1]=data[i+2]=value; data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  texture.colorSpace=THREE.SRGBColorSpace; texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.magFilter=THREE.LinearFilter; texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true; texture.needsUpdate=true; return texture;
}

/** Populate only outside the plot skirts. All geometry is independently authored primitives. */
export function addForestBackdrop(group, field, seed) {
  if (!field) return;
  const rng = createRng(seed ^ 0x73819), { origin, width, depth, spacing, heights } = field;
  const extentX = (width - 1) * spacing, extentZ = (depth - 1) * spacing;
  if (extentX < 64 || extentZ < 64) return;
  const cx = origin.x + extentX / 2, cz = origin.z + extentZ / 2;
  const pieces = [new THREE.CylinderGeometry(.12,.18,1.1,5).translate(0,.55,0),
    new THREE.ConeGeometry(1.0,2.2,7).translate(0,1.9,0),
    new THREE.ConeGeometry(.78,2.1,7).translate(0,2.65,0),
    new THREE.ConeGeometry(.5,1.7,7).translate(0,3.45,0)];
  pieces.forEach((g, i) => {
    const color = new THREE.Color(i ? 0x374522 : 0x51422c), colors = [];
    for (let n = 0; n < g.getAttribute('position').count; n++) colors.push(color.r,color.g,color.b);
    g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  });
  const treeGeo = mergeGeometries(pieces); pieces.forEach(g => g.dispose());
  const trees = new THREE.InstancedMesh(treeGeo,new THREE.MeshLambertMaterial({vertexColors:true,map:paint(seed)}),320);
  trees.name = 'forest-trees';
  const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion(), position = new THREE.Vector3(), scale = new THREE.Vector3();
  let count = 0;
  for (let n = 0; n < 3200 && count < trees.instanceMatrix.count; n++) {
    const x = origin.x + 4 + rng() * (extentX - 8), z = origin.z + 4 + rng() * (extentZ - 8);
    if ((field.plots ?? []).some(p => x > p.origin[0]-12 && x < p.origin[0]+p.width+12 && z > p.origin[2]-12 && z < p.origin[2]+p.depth+12)) continue;
    // Broad groves separated by clear turf; individual placement stays irregular.
    if (Math.sin(x*.037 + seed) + Math.cos(z*.053) + Math.sin((x+z)*.021) < .1) continue;
    const fx = (x-origin.x)/spacing, fz = (z-origin.z)/spacing, ix = Math.floor(fx), iz = Math.floor(fz);
    const tx = fx-ix, tz = fz-iz, at = (a,b) => heights[a+b*width];
    const y = (at(ix,iz)*(1-tx)+at(ix+1,iz)*tx)*(1-tz)+(at(ix,iz+1)*(1-tx)+at(ix+1,iz+1)*tx)*tz;
    position.set(x,y-.1,z); scale.setScalar(.45+rng()*.35);
    rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP,rng()*Math.PI*2);
    matrix.compose(position,rotation,scale); trees.setMatrixAt(count++,matrix);
  }
  trees.count = count; trees.instanceMatrix.needsUpdate = true; trees.computeBoundingSphere(); group.add(trees);

  const N = 128, pos = [], colors = [], uv = [], indices = [], peaks = [];
  for (let i = 0; i < N; i++) peaks.push(10 + Math.pow(rng(),2)*31);
  for (let ring = 0; ring < 4; ring++) for (let i = 0; i < N; i++) {
    const angle = i / N * Math.PI*2, stretch = ring * 65;
    const x = cx + Math.cos(angle)*(extentX/2+100+stretch), z = cz + Math.sin(angle)*(extentZ/2+100+stretch);
    const y = ring === 1 ? peaks[i]*.55 : ring === 2 ? peaks[i] : -5;
    pos.push(x,y,z); uv.push(x/9,(z+y)/9);
    const color = new THREE.Color(ring === 1 || ring === 2 ? 0x5a584b : 0x4c5434).multiplyScalar(.8+rng()*.3);
    colors.push(color.r,color.g,color.b);
  }
  for (let ring = 0; ring < 3; ring++) for (let i = 0; i < N; i++) {
    const j = (i+1)%N, a = ring*N+i, b = ring*N+j, c = a+N, d = b+N;
    indices.push(a,b,c,b,d,c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3)); geo.setIndex(indices); geo.computeVertexNormals();
  const ridge = new THREE.Mesh(geo,new THREE.MeshLambertMaterial({vertexColors:true,map:paint(seed ^ 76,true),side:THREE.DoubleSide,flatShading:true}));
  ridge.name = 'forest-ridge'; group.add(ridge);
}

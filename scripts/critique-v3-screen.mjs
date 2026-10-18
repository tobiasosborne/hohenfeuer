// owns: headless reproduction of the production camera/frustum and cannon mesh occlusion filters for reload prompts.
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import * as C from '../src/contracts.js';
import {TUNING as T} from '../src/tuning.js';
import {fixedElevation} from '../src/sim/ballistics.js';
import {createWeaponView} from '../src/render/weapon-view.js';
import {walkPose,weaponPose,composeFeel,applyPose} from '../src/player/camera.js';
import {createFeel} from '../src/player/feel.js';
import {pick} from '../src/player/interact.js';
import {localInterventions,interventionText} from '../src/player/interventions.js';
import {visibleFeatures,profileForMatch} from '../src/progression.js';
// Read geometry and authored node transforms only. Production's Lambert conversion uses FrontSide too.
function cannonModel(){
 const bytes=readFileSync(new URL('../assets/kit-v1/cannon.glb',import.meta.url)),size=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+size).toString()),bin=bytes.subarray(28+size);
 const types={5126:Float32Array,5125:Uint32Array,5123:Uint16Array,5121:Uint8Array},components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
 const attr=i=>{const a=g.accessors[i],v=g.bufferViews[a.bufferView],Ctor=types[a.componentType],n=components[a.type],step=v.byteStride??n*Ctor.BYTES_PER_ELEMENT,out=new Ctor(a.count*n);for(let j=0;j<a.count;j++){const start=(v.byteOffset??0)+(a.byteOffset??0)+j*step;const copy=bin.subarray(start,start+n*Ctor.BYTES_PER_ELEMENT);out.set(new Ctor(Uint8Array.from(copy).buffer),j*n);}return new THREE.BufferAttribute(out,n);};
 const meshes=(g.meshes??[]).map(m=>{const group=new THREE.Group();for(const p of m.primitives){const geo=new THREE.BufferGeometry();geo.setAttribute('position',attr(p.attributes.POSITION));if(p.attributes.NORMAL!==undefined)geo.setAttribute('normal',attr(p.attributes.NORMAL));if(p.indices!==undefined)geo.setIndex(attr(p.indices));group.add(new THREE.Mesh(geo,new THREE.MeshBasicMaterial()));}return group;});
 const nodes=g.nodes.map(n=>{const o=n.mesh===undefined?new THREE.Group():meshes[n.mesh].clone(true);o.name=n.name??'';o.userData={...n.extras};if(n.matrix)o.applyMatrix4(new THREE.Matrix4().fromArray(n.matrix));else{if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale);}return o;});
 g.nodes.forEach((n,i)=>(n.children??[]).forEach(c=>nodes[i].add(nodes[c])));const root=new THREE.Group();(g.scenes[g.scene??0].nodes??[]).forEach(i=>root.add(nodes[i]));root.userData.weaponId='cannon';return root;
}
const model=cannonModel();
export function screenAudit(seed,walls){
 const camera=new THREE.PerspectiveCamera(T.ruler.fovDeg,4/3,T.ruler.nearM,T.ruler.farM),views=new Map(),feel=createFeel({seed,bob:false}),features=visibleFeatures(profileForMatch(3));let lastPos=null,pose=null;
 const base=(s,previous=false)=>{const r=s.rulers[0],w=s.weapons.find(w=>w.id===r.manning);return w?weaponPose({pivot:[w.pos.x,w.pos.y,w.pos.z],azDeg:w.aim.az/10}):walkPose({pos:previous&&lastPos?lastPos:[r.pos.x,r.pos.y,r.pos.z],yaw:r.yaw/C.K.YAW_UNITS*Math.PI*2,pitch:r.pitch/C.K.PITCH_LIMIT*Math.PI/2});};
 return {
 observe(s,events){
  const r=s.rulers[0];pose??=base(s);const distance=p=>Math.hypot(p[0]-pose.pos[0],p[1]-pose.pos[1],p[2]-pose.pos[2]);
  for(const e of events){const p=e.payload,w=s.weapons.find(w=>w.id===p.weaponId),def=w&&C.getWeapon(w.defId);if(e.type===C.EV.SHOT_FIRED&&p.slot===0&&r.manning===w?.id)feel.ownShot(def.traj==='lobbed'?'throw':'hard');
   if(e.type===C.EV.IMPACT)feel.impact(def?Math.max(def.shot.splashRadius,def.shot.radius):1.25,distance(p.pos));
   if(e.type===C.EV.MAGAZINE_EXPLODED||e.type===C.EV.COLLAPSE&&p.cells?.length){const c=s.castles[p.plot],cell=p.cell??p.cells[0];if(c&&cell)feel.impact(e.type===C.EV.COLLAPSE?2:4,distance([c.plot.origin.x+cell[0]+.5,c.plot.origin.y+cell[1]+.5,c.plot.origin.z+cell[2]+.5]));}
  }
  feel.step({ruler:r});pose=composeFeel(base(s,true),feel.sample(0));lastPos=[r.pos.x,r.pos.y,r.pos.z];
 },
 choices(s,threat,weaponId){
  for(const w of s.weapons){let v=views.get(w.id);if(!v){v=createWeaponView({model:model.clone(true)});views.set(w.id,v);}v.root.position.set(w.pos.x,w.pos.y,w.pos.z);v.root.visible=w.hp>0;if(w.hp>0)v.setAim(w.aim.az/10,fixedElevation(C.getWeapon(w.defId)));}
  applyPose(camera,pose??base(s));camera.updateMatrixWorld(true);const ray=new THREE.Raycaster(),roots=[...views.values()].filter(v=>v.root.visible).map(v=>v.root);
  const visible=(pos,kind)=>{const q=new THREE.Vector3(...pos).project(camera);if(q.z<=-1||q.z>=1||Math.abs(q.x)>.96||Math.abs(q.y)>.92)return false;const y=Math.round((1-q.y)/2*768);if(y<200||y>500)return false;if(kind==='crew')return true;const d=new THREE.Vector3(...pos).sub(camera.position),len=d.length();ray.set(camera.position,d.normalize());ray.near=.05;ray.far=Math.max(.05,len-.1);return !ray.intersectObjects(roots,true).length;};
  const gun=s.weapons.find(w=>w.id===s.rulers[0].manning),reload=gun??s.weapons.find(w=>w.id===weaponId),isReload=reload?.hp>0&&reload.reload<C.getWeapon(reload.defId).reloadS;
  let actions=isReload||threat?localInterventions(s,0,{features,blueprint:walls,threatened:!!threat,visible}):[];
  const r=s.rulers[0],target=gun?null:pick({eye:[r.pos.x,r.pos.y+T.ruler.eye,r.pos.z],yaw:r.yaw/C.K.YAW_UNITS*Math.PI*2,pitch:r.pitch/C.K.PITCH_LIMIT*Math.PI/2,slot:0,plots:s.castles.map(c=>({plot:c.plot,slot:c.slot})),weapons:s.weapons.filter(w=>w.hp>0).map(w=>({id:w.id,slot:w.slot,defId:w.defId,min:[w.pos.x-.5,w.pos.y,w.pos.z-.5],max:[w.pos.x+.5,w.pos.y+1,w.pos.z+.5]}))});
  const focus=gun??(target?.own&&target.kind==='weapon'?s.weapons.find(w=>w.id===target.weaponId):null);if(focus&&focus.idleReason&&!['ready','reloading'].includes(focus.idleReason)&&!threat)actions=[];
  return {actions,lines:actions.map(a=>interventionText(a,'en',!!gun)),pose,cameraPosition:camera.position.toArray(),manning:s.rulers[0].manning};
 }
 };
}

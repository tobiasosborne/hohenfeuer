// Owns modern block, terrain, atmosphere and fire shaders; all animation uses an explicit sim time uniform.
import * as THREE from 'three';
import { TUNING } from '../tuning.js';

const R = TUNING.render.modern;
const noise = /* glsl */`
float hash21(vec2 p) { p=fract(p*vec2(123.34,345.45)); p+=dot(p,p+34.345); return fract(p.x*p.y); }
float noise2(vec2 p) {
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+1.0),f.x),f.y);
}
float cloudNoise(vec2 p) { return noise2(p)*.57+noise2(p*2.03+17.0)*.28+noise2(p*4.07+31.0)*.15; }
`;
const fog = /* glsl */`
uniform vec3 uFogColor;
uniform float uFogDensity, uFogFalloff;
vec3 heightFog(vec3 rgb, vec3 p) {
  float dy=(p.y-cameraPosition.y)*uFogFalloff;
  float integral=abs(dy)<.001 ? 1.0 : (1.0-exp(-dy))/dy;
  float optical=length(p-cameraPosition)*uFogDensity*exp(-cameraPosition.y*uFogFalloff)*integral;
  return mix(rgb,uFogColor,clamp(1.0-exp(-max(0.0,optical)),0.0,1.0));
}
`;
const vertex = /* glsl */`
#include <common>
#include <shadowmap_pars_vertex>
varying vec2 vFaceUv;
varying vec3 vWorld, vNormalWorld, vBaked;
void main() {
  vFaceUv=uv; vBaked=vec3(1.0);
  #ifdef USE_COLOR
    vBaked=color.rgb;
  #endif
  vec4 local=vec4(position,1.0);
  vec3 localNormal=normal;
  #ifdef USE_INSTANCING
    local=instanceMatrix*local;
    localNormal=mat3(instanceMatrix)*localNormal;
  #endif
  vec4 worldPosition=modelMatrix*local;
  vec4 mvPosition=viewMatrix*worldPosition;
  vec3 transformedNormal=normalize(normalMatrix*localNormal);
  vWorld=worldPosition.xyz;
  vNormalWorld=normalize(mat3(modelMatrix)*localNormal);
  gl_Position=projectionMatrix*mvPosition;
  #include <shadowmap_vertex>
}
`;
const litHeader = /* glsl */`
#include <common>
#include <packing>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
varying vec2 vFaceUv;
varying vec3 vWorld, vNormalWorld, vBaked;
uniform vec3 uSunDirection, uSunColor, uAmbientSky, uAmbientGround;
uniform float uWrap;
${noise}
${fog}
vec3 illuminate(vec3 albedo, vec3 baked) {
  vec3 n=normalize(vNormalWorld);
  float wrapped=max(0.0,(dot(n,uSunDirection)+uWrap)/(1.0+uWrap));
  vec3 ambient=mix(uAmbientGround,uAmbientSky,n.y*.5+.5);
  return albedo*baked*(ambient+uSunColor*wrapped*getShadowMask());
}
`;
const output = /* glsl */`
  gl_FragColor=vec4(heightFog(rgb,vWorld),1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`;
function uniforms(sunDir = [-.5,1,-.75]) {
  return {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.lights),
    uTime:{value:0}, uSunDirection:{value:new THREE.Vector3(...sunDir).normalize()},
    uSunColor:{value:new THREE.Color(R.sun).multiplyScalar(R.sunGain)},
    uAmbientSky:{value:new THREE.Color(R.ambientSky).multiplyScalar(R.ambientGain)},
    uAmbientGround:{value:new THREE.Color(R.ambientGround).multiplyScalar(R.ambientGain)},
    uWrap:{value:R.wrap}, uFogColor:{value:new THREE.Color(R.fog)},
    uFogDensity:{value:R.fogDensity}, uFogFalloff:{value:R.fogFalloff},
  };
}

/** One RGBA texel per atlas tile: damage quartile, iron specular, reserved, alpha. */
export function atlasStyleData(manifest) {
  const columns=manifest ? manifest.atlas.size_px/manifest.atlas.tile_px : 1;
  const data=new Uint8Array(columns*columns*4);
  for(let i=0;i<data.length;i+=4) data[i+3]=255;
  for(const block of manifest?.blocks ?? []) {
    const states=[block.atlas_tiles??[],...(block.damage_atlas_tiles??[])];
    states.forEach((tiles,state)=>{for(const tile of tiles) {
      // Manifest tiles count from the atlas bottom; exported glTF UVs and flipY=false
      // images address its top row first. Match that orientation in the metadata texture.
      const index=tile%columns+(columns-1-Math.floor(tile/columns))*columns;
      data[index*4]=state*85;data[index*4+1]=block.key==='iron'?255:0;
    }});
  }
  const texture=new THREE.DataTexture(data,columns,columns); texture.magFilter=texture.minFilter=THREE.NearestFilter;
  texture.needsUpdate=true; return texture;
}

export function createBlockMaterial({map=null,manifest=map?.userData.blockManifest, color=new THREE.Color(0xffffff), vertexColors=true, iron=false, sunDir}={}) {
  const state=atlasStyleData(manifest), columns=manifest ? manifest.atlas.size_px/manifest.atlas.tile_px : 1;
  const material=new THREE.ShaderMaterial({ name:'modern-block', lights:true, vertexColors,
    uniforms:{...uniforms(sunDir),uMap:{value:map},uHasMap:{value:!!map},uColor:{value:color.clone()},
      uAtlasState:{value:state},uColumns:{value:columns},uGutter:{value:manifest?(manifest.atlas.gutter_px+.5)/manifest.atlas.tile_px:0},
      uSpecular:{value:iron?R.ironSpecular:0}}, vertexShader:vertex,
    fragmentShader:/* glsl */`${litHeader}
    uniform sampler2D uMap, uAtlasState;
    uniform bool uHasMap;
    uniform vec3 uColor;
    uniform float uColumns,uGutter,uSpecular;
    void main() {
      // UVs already select the authored face tile, including rotation and damage variant.
      vec2 tile=floor(clamp(vFaceUv,0.0,.999999)*uColumns);
      vec2 face=fract(vFaceUv*uColumns);
      vec2 tileUv=(tile+clamp(face,vec2(uGutter),vec2(1.0-uGutter)))/uColumns;
      vec3 albedo=uColor;
      if(uHasMap) albedo*=texture2D(uMap,tileUv).rgb;
      vec2 state=texture2D(uAtlasState,(tile+.5)/uColumns).rg;
      float crack=1.0-smoothstep(.016,.043,abs(fract(face.x*3.0+noise2(face*7.0)*.65)-.5));
      float decal=state.r*crack*(.35+.65*noise2(face*19.0));
      albedo=mix(albedo,vec3(.035,.029,.024),decal*.8);
      vec3 rgb=illuminate(albedo,vBaked);
      vec3 halfVector=normalize(uSunDirection+normalize(cameraPosition-vWorld));
      float neutral=1.0-smoothstep(.015,.09,max(albedo.r,max(albedo.g,albedo.b))-min(albedo.r,min(albedo.g,albedo.b)));
      float ironMask=neutral*(1.0-smoothstep(.08,.25,max(albedo.r,max(albedo.g,albedo.b))));
      rgb+=uSunColor*pow(max(0.0,dot(normalize(vNormalWorld),halfVector)),32.0)*max(state.g*${R.ironSpecular.toFixed(3)},uSpecular*ironMask)*getShadowMask();
      ${output}
    }` });
  material.addEventListener('dispose',()=>state.dispose());
  return material;
}

export function createTerrainMaterial({field, map=null, sunDir}={}) {
  const plots=Array.from({length:4},(_,i)=>{const p=field?.plots?.[i];return p?new THREE.Vector4(p.origin[0],p.origin[2],p.width,p.depth):new THREE.Vector4(1e6,1e6,0,0);});
  return new THREE.ShaderMaterial({name:'modern-terrain',lights:true,uniforms:{...uniforms(sunDir),uPlots:{value:plots},
    uDetail:{value:map},uHasDetail:{value:!!map},uGrass:{value:new THREE.Color(R.grass)},uSand:{value:new THREE.Color(R.sand)},uRock:{value:new THREE.Color(R.rock)}},vertexShader:vertex,
    fragmentShader:/* glsl */`${litHeader}
    uniform vec4 uPlots[4];
    uniform sampler2D uDetail; uniform bool uHasDetail;
    uniform vec3 uGrass,uSand,uRock;
    void main() {
      vec2 p=vWorld.xz;
      float macro=noise2(p*.035), detail=noise2(p*2.4);
      float sand=1.0-smoothstep(.15,1.6,vWorld.y);
      for(int i=0;i<4;i++) {
        vec2 d=max(max(uPlots[i].xy-p,p-uPlots[i].xy-uPlots[i].zw),0.0);
        sand=max(sand,1.0-smoothstep(.7,5.0,length(d)+(macro-.5)*2.4));
      }
      float rock=smoothstep(.12,.48,1.0-normalize(vNormalWorld).y);
      rock=max(rock,smoothstep(14.0,27.0,vWorld.y)*.7);
      vec3 albedo=mix(mix(uGrass,uSand,sand),uRock,rock);
      float grain=uHasDetail ? texture2D(uDetail,p/2.5).r : detail;
      albedo*=.68+macro*.35+detail*.10+grain*.22;
      vec3 rgb=illuminate(albedo,vec3(1.0));
      ${output}
    }`});
}

export function createSkyMaterial({sunDir}={}) {
  return new THREE.ShaderMaterial({name:'modern-sky',side:THREE.BackSide,depthWrite:false,
    uniforms:{...uniforms(sunDir),uZenith:{value:new THREE.Color(R.zenith)},uHorizon:{value:new THREE.Color(R.horizon)}},
    vertexShader:/* glsl */`varying vec3 vDirection; void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:/* glsl */`
    varying vec3 vDirection;
    uniform float uTime;
    uniform vec3 uZenith,uHorizon,uSunDirection;
    ${noise}
    void main(){
      vec3 d=normalize(vDirection);
      vec3 rgb=mix(uHorizon,uZenith,pow(max(0.0,d.y),.5));
      // Two perspective cloud strata, world anchored directions; phase advances only with sim ticks.
      vec2 p=d.xz/max(.09,d.y+.12);
      float low=cloudNoise(p*1.65+vec2(uTime*.004,0.0));
      float high=cloudNoise(p*3.7+vec2(14.0,uTime*.002));
      float horizonFade=smoothstep(-.02,.16,d.y);
      float a=smoothstep(.52,.68,low)*horizonFade*.82;
      float b=smoothstep(.60,.82,high)*horizonFade*.38;
      rgb=mix(rgb,mix(vec3(.45,.52,.60),vec3(1.05,1.08,1.1),smoothstep(.5,.8,low)),a);
      rgb=mix(rgb,vec3(.93,.98,1.05),b);
      float sun=dot(d,uSunDirection);
      rgb+=vec3(1.0,.75,.42)*pow(max(0.0,sun),80.0)*.18;
      rgb=mix(rgb,vec3(3.8,3.1,2.15),smoothstep(.99965,.99983,sun)*(1.0-a));
      rgb=mix(uHorizon,rgb,smoothstep(-.04,.07,d.y));
      gl_FragColor=vec4(rgb,1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
}

export function createFireMaterial() {
  return new THREE.ShaderMaterial({name:'modern-fire',transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
    uniforms:{uTime:{value:0}},vertexShader:/* glsl */`
    varying vec2 vUv; varying float vSeed;
    void main(){vUv=uv;vec4 p=vec4(position,1.0);vSeed=0.0;
      #ifdef USE_INSTANCING
      p=instanceMatrix*p;vSeed=instanceMatrix[3].x*.7+instanceMatrix[3].z*.3;
      #endif
      gl_Position=projectionMatrix*modelViewMatrix*p;
    }`,fragmentShader:/* glsl */`
    varying vec2 vUv; varying float vSeed; uniform float uTime;
    ${noise}
    void main(){
      float flow=noise2(vec2(vUv.x*5.0+vSeed,vUv.y*4.0-uTime*2.3));
      float edge=1.0-abs(vUv.x-.5)*2.0-vUv.y*.65+(flow-.5)*.45;
      float a=smoothstep(.03,.35,edge)*(1.0-smoothstep(.50,1.0,vUv.y));
      vec3 rgb=mix(vec3(2.8,.22,.015),vec3(4.0,2.1,.35),(1.0-vUv.y)*flow);
      gl_FragColor=vec4(rgb,a*.8);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
}

/** Dry-map stub. Terrain/biome contracts currently expose no water-cell mask or water elevation.
 * Do not infer rivers from low land: a future water map must supply explicit cells first. */
export function createWaterView() {
  const group=new THREE.Group();group.name='modern-water';
  return {group,supported:false,reason:'No water cells in the current terrain/biome contract',dispose(){group.removeFromParent();}};
}

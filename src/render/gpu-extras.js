// Owns optional modern depth fade, eight-tap SSAO-lite and bloom through pinned three r186 passes.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { TUNING } from '../tuning.js';

export function createGpuExtras(renderer,scene,camera) {
  const R=TUNING.render, depth=new THREE.WebGLRenderTarget(R.logicalW,R.logicalH);
  depth.depthTexture=new THREE.DepthTexture(R.logicalW,R.logicalH,THREE.UnsignedIntType);
  const depthMaterial=new THREE.MeshDepthMaterial();
  const uniforms={uSceneDepth:{value:depth.depthTexture},uViewport:{value:new THREE.Vector2(R.logicalW,R.logicalH)},
    uNear:{value:camera.near},uFar:{value:camera.far}};
  const sprites=new Map(), shadows=new Map(), hidden=[];
  const composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  // The stock SSAOPass generates random kernels and re-renders normals. This deterministic,
  // fixed eight-tap depth variant uses ShaderPass and the same depth target as soft particles.
  const ao=new ShaderPass({uniforms:{tDiffuse:{value:null},...uniforms},
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:/* glsl */`
    #include <packing>
    varying vec2 vUv; uniform sampler2D tDiffuse,uSceneDepth;
    uniform vec2 uViewport; uniform float uNear,uFar;
    void main(){
      float raw=texture2D(uSceneDepth,vUv).r;
      float z=-perspectiveDepthToViewZ(raw,uNear,uFar), occ=0.0;
      for(int i=0;i<8;i++){
        float angle=float(i)*.7853981634;
        vec2 delta=vec2(cos(angle),sin(angle))*min(9.0,90.0/max(1.0,z))/uViewport;
        float other=-perspectiveDepthToViewZ(texture2D(uSceneDepth,vUv+delta).r,uNear,uFar);
        float d=z-other;occ+=smoothstep(.035,.24,d)*(1.0-smoothstep(.4,2.0,d));
      }
      vec4 c=texture2D(tDiffuse,vUv);gl_FragColor=vec4(c.rgb*(1.0-occ*.026*step(raw,.99999)),c.a);
    }`});
  composer.addPass(ao);
  const bloom=new UnrealBloomPass(new THREE.Vector2(R.logicalW,R.logicalH),R.modern.bloomStrength,R.modern.bloomRadius,R.modern.bloomThreshold);
  composer.addPass(bloom);composer.addPass(new OutputPass());
  function prepare(o) {
    if(o.isMesh && !o.material?.transparent && o.name!=='sky'){
      if(!shadows.has(o))shadows.set(o,[o.castShadow,o.receiveShadow]);
      o.castShadow=true;o.receiveShadow=true;
    }
    if(!o.isSprite || sprites.has(o.material))return;
    const m=o.material, previous=m.onBeforeCompile, key=m.customProgramCacheKey;
    sprites.set(m,{previous,key});
    m.onBeforeCompile=function(shader,webgl){
      previous.call(this,shader,webgl);Object.assign(shader.uniforms,uniforms);
      shader.fragmentShader='#include <packing>\nuniform sampler2D uSceneDepth; uniform vec2 uViewport; uniform float uNear,uFar;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
        float sceneZ=-perspectiveDepthToViewZ(texture2D(uSceneDepth,gl_FragCoord.xy/uViewport).r,uNear,uFar);
        float particleZ=-perspectiveDepthToViewZ(gl_FragCoord.z,uNear,uFar);
        diffuseColor.a*=smoothstep(0.0,.7,sceneZ-particleZ);
        #include <opaque_fragment>`);
    };
    m.customProgramCacheKey=()=>`${key.call(m)}:modern-soft-depth`;m.needsUpdate=true;
  }
  function hideTransparent(o){if(o.visible&&(o.isSprite||o.name==='sky'||(o.isMesh&&o.material?.transparent))){hidden.push(o);o.visible=false;}}
  return {
    composer,depth,
    render(){
      scene.traverse(prepare);scene.traverse(hideTransparent);
      const override=scene.overrideMaterial, background=scene.background;
      scene.overrideMaterial=depthMaterial;scene.background=null;
      renderer.setRenderTarget(depth);renderer.clear();renderer.render(scene,camera);
      renderer.setRenderTarget(null);scene.overrideMaterial=override;scene.background=background;
      for(const o of hidden)o.visible=true;hidden.length=0;
      composer.render(0); // no wall-clock delta or temporal accumulation
    },
    dispose(){
      for(const [m,{previous,key}] of sprites){
        m.onBeforeCompile=previous;m.customProgramCacheKey=key;
        // r186 caches uniforms per material program. Release patched programs so a later
        // modern entry cannot reuse a disposed depth target; the material/map remain reusable.
        m.dispose();m.needsUpdate=true;
      }
      for(const [o,[cast,receive]] of shadows){o.castShadow=cast;o.receiveShadow=receive;}
      for(const pass of composer.passes)pass.dispose?.();composer.dispose();depth.dispose();depthMaterial.dispose();
      sprites.clear();shadows.clear();
    },
  };
}

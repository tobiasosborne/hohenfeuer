// owns: browser entry point; smoke first-person scene and test hook (replaced by real game wiring later).
import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";

const EYE_HEIGHT = 1.7;
const SPEED = 4;

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b4e0);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, EYE_HEIGHT, 6);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshLambertMaterial({ color: 0x4f7a3a }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const stone = new THREE.MeshLambertMaterial({ color: 0x9a968c });
const block = new THREE.BoxGeometry(1, 1, 1);
for (let x = -3; x <= 3; x++) {
  for (let y = 0; y < 2; y++) {
    const m = new THREE.Mesh(block, stone);
    m.position.set(x, y + 0.5, 0);
    scene.add(m);
  }
}

scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(5, 10, 7);
scene.add(sun);

const controls = new PointerLockControls(camera, renderer.domElement);
renderer.domElement.addEventListener("click", () => controls.lock());

const keys = new Set();
window.addEventListener("keydown", (e) => keys.add(e.code));
window.addEventListener("keyup", (e) => keys.delete(e.code));

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  const f = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
  const r = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
  if (f) controls.moveForward(f * SPEED * dt);
  if (r) controls.moveRight(r * SPEED * dt);
  camera.position.y = EYE_HEIGHT;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__hohenfeuer = { ready: true, scene, camera, renderer };

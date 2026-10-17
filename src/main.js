// src/main.js - owns the TB1 boot: plugins, sim, renderer, input, cameras, HUD, audio, fixed-step loop and the debug hook.
// URL params: golden=1 (no wall-clock sim time; the sim advances only through stepTo/setPose), demo=1 (the TB1 script
// plays the slice in real time), seed=<n>, lang=de|en, kit=0 (fallback block palette).
import * as THREE from "three";
import { CMD, EV, CAMERA_MODE, K, freezeRegistries, getWeapon, getCastle, getView, getMap } from "./contracts.js";
import { TUNING as T } from "./tuning.js";
import { registerCoreSim } from "./plugins/index.sim.js";
import { registerCoreView } from "./plugins/index.view.js";
import { createSim } from "./sim/sim.js";
import { createLoop } from "./core/loop.js";
import { weaponRangeTable } from "./sim/weapons.js";
import { dialToElevation, traceFlight } from "./sim/ballistics.js";
import { windHud } from "./sim/wind.js";
import { palaceIntegrity } from "./sim/rules.js";
import { createRenderer } from "./render/renderer.js";
import { createSky } from "./render/sky.js";
import { createTerrainView } from "./render/terrain-view.js";
import { createChunkManager } from "./render/chunks.js";
import { createModelSet, fallbackModels } from "./render/mesher.js";
import { createWeaponView } from "./render/weapon-view.js";
import { createFx } from "./render/fx.js";
import { createAssets } from "./render/assets.js";
import { installDebugApi } from "./render/debug-api.js";
import { createInput } from "./player/input.js";
import { buildCommands } from "./player/commands.js";
import { createCameraRig, applyPose } from "./player/camera.js";
import { pick } from "./player/interact.js";
import { createHud } from "./ui/hud.js";
import { createMessageLog, eventsToMessages, TONE } from "./ui/console.js";
import { topDown } from "./ui/minimap.js";
import { t } from "./ui/i18n.js";
import { createMenu } from "./ui/menus.js";
import { createSfx } from "./audio/sfx.js";
import { TB1, tb1Slots, createTb1Script, ballNearEnemy } from "./tb1-script.js";

const DEG = Math.PI / 180;
const q = new URLSearchParams(globalThis.location.search);
const GOLDEN = q.get("golden") === "1";
const DEMO = q.get("demo") === "1";
const SEED = Number(q.get("seed") ?? TB1.seed) >>> 0;
const LANG = q.get("lang") === "en" ? "en" : "de";
const ME = TB1.playerSlot;

/* ------------------------------------------------------------------ registries and sim */
registerCoreSim();
registerCoreView();
freezeRegistries();
const sim = createSim({ map: TB1.map, seed: SEED, slots: tb1Slots() });
const mapDef = getMap(TB1.map);
let view = sim.state;
let prev = capture(view);
let lastEvents = [];

function capture(s) {
  return {
    rulers: new Map(s.rulers.map((r) => [r.slot, { ...r.pos }])),
    projectiles: new Map(s.projectiles.map((p) => [p.id, { ...p.pos }])),
  };
}
const lerp3 = (a, b, k) => (a ? [a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k] : [b.x, b.y, b.z]);

/* ------------------------------------------------------------------ renderer */
const biome = getView("biome", "forest");
const sunDir = biome?.sun?.direction ? [...biome.sun.direction] : [-0.55, 0.7, 0.45];
const r = createRenderer({ biome: "forest", sunDir });
document.body.appendChild(r.domElement);
const camera = r.camera;

const sky = createSky({ seed: SEED });
r.scene.add(sky.mesh);
r.onBeforeRender((cam) => sky.follow(cam));
const terrain = createTerrainView({ field: view.terrain, biome: "forest" });
r.scene.add(terrain.group);

// Render-side mirror plots: the sim hands out snapshots, so the chunk mesher keeps its own copies.
const mirrors = view.castles.map((c) => c.plot);

const assets = createAssets();
let models = null, material = null, kit = "fallback", kitError = null;
if (q.get("kit") !== "0") {
  try {
    const k = await assets.loadBlockKit("/assets/kit-v0/");
    models = k.models;
    material = new THREE.MeshLambertMaterial({ map: k.atlas, vertexColors: true });
    kit = "kit-v0";
  } catch (e) { kitError = String(e); }
}
if (!models) { models = fallbackModels(); material = new THREE.MeshLambertMaterial({ vertexColors: true }); }
const chunks = createChunkManager({ models: createModelSet(models), material, meshOpts: { sunDir } });
for (const p of mirrors) chunks.addPlot(p);
chunks.flush();
r.scene.add(chunks.group);

const weaponViews = new Map(view.weapons.map((w) => {
  const wv = createWeaponView();
  wv.root.position.set(w.pos.x, w.pos.y, w.pos.z);
  r.scene.add(wv.root);
  return [w.id, wv];
}));
function elevationOf(w) { return dialToElevation(weaponRangeTable(getWeapon(w.defId)), w.aim.range / T.aim.rangeUnitsPerDial); }

const SLOT_COLORS = ["#c02828", "#2860c0", "#28a040", "#c0a020"];
const rulerViews = new Map(view.rulers.map((ru) => {
  const g = new THREE.Group();
  const cloth = new THREE.MeshLambertMaterial({ color: SLOT_COLORS[ru.slot] });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 0.32), cloth); body.position.y = 0.75;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), new THREE.MeshLambertMaterial({ color: 0xe0c0a0 })); head.position.y = 1.5;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.12, 8), new THREE.MeshLambertMaterial({ color: 0xe0b030 })); crown.position.y = 1.7;
  g.add(body, head, crown);
  r.scene.add(g);
  return [ru.slot, g];
}));

const ballGeo = new THREE.SphereGeometry(0.3, 10, 8), ballMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2c });
const balls = new Map();
const fx = createFx({ scene: r.scene, seed: SEED });

/* ------------------------------------------------------------------ HUD, audio, input */
const hudCanvas = document.createElement("canvas");
Object.assign(hudCanvas.style, { position: "absolute", left: "0", top: "0", pointerEvents: "none" });
document.body.appendChild(hudCanvas);
const hud = createHud(hudCanvas);
function sizeHud() { hudCanvas.width = globalThis.innerWidth; hudCanvas.height = globalThis.innerHeight; }
sizeHud();
globalThis.addEventListener("resize", sizeHud);
const log = createMessageLog({ max: T.ui.messageMax, ttlTicks: T.ui.messageLifetimeS * K.TICK_HZ });
const sfx = createSfx();
const craters = [];
let menu = null;

const el = r.domElement;
const toLogical = (x, y) => { const b = el.getBoundingClientRect(); return { x: (x - b.left) / b.width * T.render.logicalW, y: (y - b.top) / b.height * T.render.logicalH }; };
const input = createInput({ element: el, toLogical, slot: ME, weaponDefs: ["cannon"], sensitivity: T.ruler.mouseSensitivity });
input.setLook(Math.PI / 2, 0); // face the enemy (east)
const unlockAudio = () => { sfx.unlock(); };
globalThis.addEventListener("pointerdown", unlockAudio);
globalThis.addEventListener("keydown", unlockAudio);
globalThis.addEventListener("keydown", (e) => { if (menu && (e.code === "Enter" || e.code === "NumpadEnter")) globalThis.location.reload(); });

const rig = createCameraRig(camera, { seed: SEED, golden: GOLDEN || DEMO });
let script = DEMO ? createTb1Script() : null;
let freeCamera = null; // explicit debug pose overrides the rig
const queued = [];
let impactHeld = false, freeLook = { yaw: 0, pitch: 0 };

/* ------------------------------------------------------------------ tick */
function ownWeaponsAabbs() {
  return view.weapons.filter((w) => w.hp > 0).map((w) => ({ id: w.id, slot: w.slot, crewOrdered: w.crewOrdered,
    min: [w.pos.x - 0.5, w.pos.y, w.pos.z - 0.5], max: [w.pos.x + 0.5, w.pos.y + 1, w.pos.z + 0.5] }));
}

function cameraMode() {
  const me = view.rulers[ME];
  if (me.hp <= 0) return CAMERA_MODE.DEATH;
  if (me.manning !== null && me.manning !== undefined) return impactHeld && mannedWeapon()?.lastImpact ? CAMERA_MODE.IMPACT : CAMERA_MODE.WEAPON;
  return CAMERA_MODE.WALK;
}
const mannedWeapon = () => { const m = view.rulers[ME].manning; return m === null || m === undefined ? null : view.weapons.find((w) => w.id === m) ?? null; };

function playerCommands() {
  input.setMode(cameraMode());
  const me = view.rulers[ME], w = mannedWeapon();
  const eye = [me.pos.x, me.pos.y + T.ruler.eye, me.pos.z];
  const target = w ? null : pick({ eye, yaw: input.sample ? lookYaw() : 0, pitch: lookPitch(), slot: ME,
    plots: mirrors.map((p, i) => ({ plot: p, slot: i })), weapons: ownWeaponsAabbs() });
  const s = input.sample({ weapon: w ? { id: w.id, az: w.aim.az, range: w.aim.range, autoFire: w.autoFire, crewOrdered: w.crewOrdered } : null, target, shelterOn: view.castles[ME].shelter });
  impactHeld = !!s.impactHeld;
  freeLook = s.freeLook || freeLook;
  look = s.look;
  return buildCommands(s, view.tick);
}
let look = { yaw: Math.PI / 2, pitch: 0 };
const lookYaw = () => look.yaw, lookPitch = () => look.pitch;

function tick() {
  if (view.outcome) return;
  prev = capture(view);
  let cmds = script ? script.next(view) : GOLDEN ? [] : playerCommands();
  for (const c of queued.splice(0)) {
    const slot = c.slot ?? ME;
    cmds.push({ ...c, slot, tick: view.tick, seq: cmds.filter((x) => x.slot === slot).length });
  }
  sim.tick(cmds);
  const events = sim.drainEvents();
  view = sim.state;
  handleEvents(events);
  fx.update(K.DT);
  for (const p of view.projectiles) fx.trail(new THREE.Vector3(p.pos.x, p.pos.y, p.pos.z));
}

function handleEvents(events) {
  lastEvents = events;
  const touched = new Set();
  for (const e of events) {
    const p = e.payload;
    if (e.type === EV.BLOCK_DAMAGED || e.type === EV.BLOCK_DESTROYED) touched.add(p.plot), chunks.markCell(mirrors[p.plot], ...p.cell);
    else if (e.type === EV.COLLAPSE) { touched.add(p.plot); for (const c of p.cells) chunks.markCell(mirrors[p.plot], ...c); }
    else if (e.type === EV.SHOT_FIRED) {
      fx.muzzleFlash(new THREE.Vector3(...p.pos));
      log.push(t(p.slot === ME ? "shotFired" : "enemyFires", LANG), { tick: view.tick, tone: p.slot === ME ? TONE.INFO : TONE.BAD });
    } else if (e.type === EV.IMPACT) {
      fx.impactPuff(new THREE.Vector3(...p.pos));
      if (p.slot === ME) {
        const enemy = view.castles[1 - ME], o = enemy.plot.origin;
        const inside = p.pos[0] >= o.x && p.pos[0] < o.x + enemy.plot.width && p.pos[2] >= o.z && p.pos[2] < o.z + enemy.plot.depth;
        if (inside && p.hit !== "terrain") {
          craters.push({ x: p.pos[0] - o.x, z: p.pos[2] - o.z, r: 1.5 });
          log.push(t("hit", LANG, { pct: Math.round(palaceIntegrity(enemy) * 100) }), { tick: view.tick, tone: TONE.GOOD });
        } else log.push(t("miss", LANG), { tick: view.tick, tone: TONE.INFO });
      }
    } else if (e.type === EV.GAME_OVER) menu = createMenu();
  }
  for (const id of touched) {
    const src = view.castles[id].plot, m = mirrors[id];
    m.type.set(src.type); m.hp.set(src.hp); m.meta.set(src.meta);
  }
  for (const m of eventsToMessages(events, { lang: LANG, slot: ME })) log.push(m.text, { tick: view.tick, tone: m.tone });
  if (!GOLDEN) sfx.handle(events, [camera.position.x, camera.position.y, camera.position.z]);
}

/* ------------------------------------------------------------------ render */
let lastFrameMs = null;
function frame(alpha) {
  const now = globalThis.performance.now();
  const dt = lastFrameMs === null ? K.DT : Math.min(0.25, (now - lastFrameMs) / 1000);
  lastFrameMs = now;
  const me = view.rulers[ME];
  const mode = cameraMode();
  for (const [slot, g] of rulerViews) {
    const ru = view.rulers[slot];
    g.visible = ru.hp > 0 && (slot !== ME || mode === CAMERA_MODE.DEATH || mode === CAMERA_MODE.GHOST || freeCamera !== null);
    const pos = lerp3(prev.rulers.get(slot), ru.pos, alpha);
    g.position.set(...pos);
    g.rotation.y = -(ru.yaw / K.YAW_UNITS) * Math.PI * 2;
  }
  for (const w of view.weapons) {
    const wv = weaponViews.get(w.id);
    wv.root.visible = w.hp > 0;
    if (w.hp > 0) wv.setAim(w.aim.az / T.aim.azUnitsPerDeg, elevationOf(w));
  }
  const live = new Set();
  for (const p of view.projectiles) {
    live.add(p.id);
    if (!balls.has(p.id)) { const b = new THREE.Mesh(ballGeo, ballMat); r.scene.add(b); balls.set(p.id, b); }
    balls.get(p.id).position.set(...lerp3(prev.projectiles.get(p.id), p.pos, alpha));
  }
  for (const [id, b] of balls) if (!live.has(id)) { r.scene.remove(b); balls.delete(id); }

  if (freeCamera) applyPose(camera, freeCamera);
  else {
    const scripted = script !== null || GOLDEN;
    const yaw = scripted ? (me.yaw / K.YAW_UNITS) * Math.PI * 2 : look.yaw;
    const pitch = scripted ? 0 : look.pitch;
    const w = mannedWeapon();
    rig.update({
      mode, dt,
      ruler: { pos: lerp3(prev.rulers.get(ME), me.pos, alpha), yaw, pitch, moving: !scripted },
      weapon: w ? { pivot: [w.pos.x, w.pos.y, w.pos.z], azDeg: w.aim.az / T.aim.azUnitsPerDeg } : undefined,
      freeLook,
      impact: w && w.lastImpact ? { point: [w.lastImpact.x, w.lastImpact.y, w.lastImpact.z], azDeg: w.aim.az / T.aim.azUnitsPerDeg } : undefined,
      groundY: me.pos.y,
    });
  }
  chunks.update(camera.position);
  r.render();
  hud.draw(hudView(mode));
}

const predictedCache = { key: null, point: null };
function predicted(w) {
  const key = `${w.id}:${w.aim.az}:${w.aim.range}`;
  if (predictedCache.key !== key) {
    const def = getWeapon(w.defId), az = w.aim.az / T.aim.azUnitsPerDeg;
    const res = traceFlight({ v0: def.v0, k: def.k, elevation: elevationOf(w), azimuth: az, pos: { x: w.pos.x, y: w.pos.y + 0.5, z: w.pos.z }, landingY: w.pos.y });
    predictedCache.key = key; predictedCache.point = res.pos;
  }
  const v = new THREE.Vector3(predictedCache.point.x, predictedCache.point.y, predictedCache.point.z).project(camera);
  return [Math.round((v.x + 1) / 2 * T.render.logicalW), Math.round((1 - v.y) / 2 * T.render.logicalH)];
}

const minimapCache = { tick: -1, own: null, enemy: null };
function hudView(mode) {
  const meC = view.castles[ME], enemy = view.castles[1 - ME], w = mannedWeapon();
  if (minimapCache.tick !== view.tick) {
    const local = (c, wp) => [Math.floor(wp.pos.x - c.plot.origin.x), Math.floor(wp.pos.y - c.plot.origin.y), Math.floor(wp.pos.z - c.plot.origin.z)];
    minimapCache.own = topDown(mirrors[ME], view.weapons.filter((x) => x.slot === ME && x.hp > 0).map((x) => ({ cell: local(meC, x) })));
    minimapCache.enemy = { ...topDown(mirrors[1 - ME], []), craters, missArrowDeg: null };
    minimapCache.tick = view.tick;
  }
  const wind = windHud(view.wind, ME);
  const camYaw = ((-camera.rotation.y / DEG) % 360 + 360) % 360;
  const ec = { x: enemy.plot.origin.x + enemy.plot.width / 2, z: enemy.plot.origin.z + enemy.plot.depth / 2 };
  const bearing = ((Math.atan2(ec.x - camera.position.x, -(ec.z - camera.position.z)) / DEG) + 360) % 360;
  const def = w ? getWeapon(w.defId) : null;
  return {
    lang: LANG, mode, tick: view.tick,
    gold: Math.floor(meC.gold), pop: { now: meC.population, start: meC.initialPopulation },
    weapons: { now: view.weapons.filter((x) => x.slot === ME && x.hp > 0).length, cap: mapDef.weaponCap },
    heading: camYaw,
    wind: { speed: wind.speed, dirDeg: wind.direction, prevDirDeg: wind.previousDirection },
    enemies: [{ bearingDeg: bearing, ally: false, color: SLOT_COLORS[1 - ME] }],
    weapon: w ? {
      name: t("cannon", LANG), hpPct: (w.hp / def.hp) * 100, az: w.aim.az, range: w.aim.range,
      reload: Math.min(1, w.reload / def.reloadS), loaded: w.reload + 1e-9 >= def.reloadS,
      fireCost: def.fireCost, affordable: meC.gold >= def.fireCost, autoFire: w.autoFire, crewOrdered: w.crewOrdered,
      restoreLit: w.aim.az !== w.lastAim.az || w.aim.range !== w.lastAim.range,
    } : null,
    morale: { value: meC.morale }, selection: null, shelterOn: meC.shelter,
    messages: log.visible(view.tick),
    enemyLabel: { title: t("enemy", LANG), name: "KI", castle: getCastle(enemy.defId ?? "default")?.name?.[LANG] ?? "" },
    minimapOwn: minimapCache.own, minimapEnemy: minimapCache.enemy,
    reticle: w && mode === CAMERA_MODE.WEAPON ? { predicted: predicted(w) } : {},
    castleColor: SLOT_COLORS[ME],
    menu,
  };
}

/* ------------------------------------------------------------------ loop and debug hook */
const loop = createLoop({
  tick, render: frame,
  requestFrame: (f) => globalThis.requestAnimationFrame(f), cancelFrame: (h) => globalThis.cancelAnimationFrame(h),
  visibility: document,
});

function stepTo(target, until) {
  let n = 0;
  while (view.tick < target && !view.outcome && !(until && until(view))) { tick(); n++; }
  return n;
}

const api = installDebugApi({
  view: r,
  stepTo: (target) => stepTo(target),
  extras: {
    sim, kit, kitError, chunks, hud, script: () => script,
    /** Queue a command for the next tick (tick and seq are filled in; slot defaults to 0). */
    issue(cmd) { queued.push({ ...cmd }); return queued.length; },
    /** Start the TB1 script (walk, man, aim, fire) from the current tick. */
    runScript() { script = createTb1Script(); return true; },
    /** Advance the scripted slice until the slot-0 ball is in flight near the enemy castle. */
    toFirstShotMidFlight(maxTicks = 60 * K.TICK_HZ) {
      script ??= createTb1Script();
      stepTo(view.tick + maxTicks, (s) => ballNearEnemy(s));
      return view.tick;
    },
  },
});
// Live getters (installDebugApi spreads extras, which would freeze getter values).
Object.defineProperties(api, {
  state: { get: () => view, enumerable: true },
  events: { get: () => lastEvents, enumerable: true },
  mode: { get: () => cameraMode(), enumerable: true },
});
const lanePose = api.setPose;
/**
 * Golden poses on index.html: { script: 'tb1', until: 'ball-near-enemy' | tick } runs the scripted slice;
 * { tick } steps the sim; { position, yaw, pitch, fov } pins a free debug camera (lane D convention) unless
 * camera: "rig" (the player camera rig decides; position/yaw/pitch then only serve tools/blender, which needs them).
 */
api.setPose = (p) => {
  if (p.script === "tb1") {
    script ??= createTb1Script();
    if (p.until === "ball-near-enemy") api.toFirstShotMidFlight();
    else if (Number.isInteger(p.until)) stepTo(p.until);
  } else if (Number.isInteger(p.tick)) stepTo(p.tick);
  chunks.flush(); // goldens must not depend on how many frames the remesh budget gets
  if (p.position && p.camera !== "rig") { freeCamera = { pos: p.position, yaw: -(p.yaw ?? 0), pitch: p.pitch ?? 0, roll: 0, fov: p.fov ?? T.ruler.fovDeg }; lanePose(p); }
  frame(0);
  return { tick: view.tick, mode: cameraMode() };
};
api.stepTo = (target) => { stepTo(target); frame(0); return view.tick; };
api.frame = () => frame(0);

frame(0);
if (GOLDEN) {
  const still = () => { frame(0); globalThis.requestAnimationFrame(still); };
  globalThis.requestAnimationFrame(still);
} else loop.start();
api.ready = true;

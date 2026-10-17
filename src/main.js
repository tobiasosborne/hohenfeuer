// src/main.js - owns playable boot: plugins, sim, renderer, input, cameras, HUD, audio, fixed-step loop and debug wiring.
// Flow: a bare URL opens the title menu (src/ui/frontend.js); Start boots the match on the same page with the skirmish
// settings; restart / back to title / back to setup hand over through sessionStorage (src/ui/flow.js) and reload.
// URL params: golden=1 (advance only through the debug API), demo=1 (TB1 palace shot), demo=tb2 (crewed wall shot),
// play=1 (skip the menu, TB1 defaults), screen=main|skirmish|options|credits|tutorial|splash (menu screen; golden=1 for goldens),
// demo=tb3 (rampart designation and mason construction), speed=<0.25..4> (demo time-lapse), seed=<n>, lang=de|en,
// kit=v1 (default) | 0 or v0 (kit v0) | none (fallback block palette).
import * as THREE from "three";
import { CMD, EV, CAMERA_MODE, K, PLUGIN_KIND, listPlugins, getBlock, freezeRegistries, getWeapon, getCastle, getView, getMap } from "./contracts.js";
import { TUNING as T } from "./tuning.js";
import { registerCoreSim } from "./plugins/index.sim.js";
import { registerCoreView } from "./plugins/index.view.js";
import { reservedGold } from "./sim/economy.js";
import { createSim } from "./sim/sim.js";
import { createLoop } from "./core/loop.js";
import { fixedElevation, traceFlight, weaponAvailable } from "./sim/ballistics.js";
import { windHud } from "./sim/wind.js";
import { readStyle } from "./render/styles.js";
import { createRenderer } from "./render/renderer.js";
import { createSky } from "./render/sky.js";
import { createTerrainView } from "./render/terrain-view.js";
import { createGhostView } from "./render/ghost-view.js";
import { createChunkManager } from "./render/chunks.js";
import { createModelSet, fallbackModels } from "./render/mesher.js";
import { createWeaponView } from "./render/weapon-view.js";
import { createPeopleView } from "./render/people-view.js";
import { createFx } from "./render/fx.js";
import { createAssets } from "./render/assets.js";
import { installDebugApi } from "./render/debug-api.js";
import { createInput } from "./player/input.js";
import { buildCommands, BUILD, ACTION } from "./player/commands.js";
import { createCameraRig, applyPose, followPose, impactPose } from "./player/camera.js";
import { createFeel, createFollow } from "./player/feel.js";
import { createBubbles, npcMarker, moraleBand } from "./ui/overlay.js";
import { pick, ghost } from "./player/interact.js";
import { createHud, designationMessages } from "./ui/hud.js";
import { createMessageLog, eventsToMessages, TONE } from "./ui/console.js";
import { topDown } from "./ui/minimap.js";
import { t } from "./ui/i18n.js";
import { createMenu, SCREEN, MENU_EVENT } from "./ui/menus.js";
import { resolveBoot, settingsToMatch, matchResult, flowRecord, defaultSettings, FLOW_KEY } from "./ui/flow.js";
import { loadOptions, saveOptions, DEFAULT_OPTIONS } from "./ui/options.js";
import { runFrontEnd } from "./ui/frontend.js";
import { createSfx } from "./audio/sfx.js";
import { TB1, tb1Slots, createTb1Script, ballNearEnemy, solveAim } from "./tb1-script.js";
import { createTb3Script, TB3 } from "./tb3-script.js";
import { windVector } from "./sim/wind.js";
import { createProgression, loadProfile, freshProfile, profileForMatch, contextualPrompt, WEAPON_ORDER } from "./progression.js";
import { createBattleFeedback, palaceStatus, pressureText, idleDiagnosis, impactText, cardinal, lossAccount, readableWork } from "./ui/battle-feedback.js";
import { localInterventions, localWorkProgress, interventionText } from "./player/interventions.js";
import { raycast } from "./world/grid.js";

/** Scripted slices: tb1 = palace shot; tb2 = crewed wall shot; tb3 = rampart designation and mason construction. */
const SCRIPTS = { tb1: () => createTb1Script(), feel: () => createTb1Script(), tb2: () => createTb1Script({ orderCrew: true, target: "wall" }), tb3: () => createTb3Script() };

const DEG = Math.PI / 180;
const q = new URLSearchParams(globalThis.location.search);
const GOLDEN = q.get("golden") === "1";
const DEMO = q.get("demo") === "1" || ["tb2", "tb3", "feel"].includes(q.get("demo"));
const DEMO_FEEL = q.get("demo") === "feel"; // TB1 slice with head bob and the follow cam on (feel video)
const DEMO_TB2 = q.get("demo") === "tb2";
const SEED = Number(q.get("seed") ?? TB1.seed) >>> 0;
const LANG_PARAM = q.get("lang") === "en" || q.get("lang") === "de" ? q.get("lang") : null;
const SPEED = Math.max(0.25, Math.min(4, Number(q.get("speed") ?? 1) || 1)); // demo time-lapse factor on the loop clock
const ME = TB1.playerSlot;

/* ------------------------------------------------------------------ registries and sim */
registerCoreSim();
registerCoreView();
freezeRegistries();
let debugSimApi;
/* ------------------------------------------------------------------ flow: title menu or match */
const safe = (f) => { try { return f(); } catch { return null; } };
const storage = safe(() => globalThis.localStorage), session = safe(() => globalThis.sessionStorage);
const boot = resolveBoot(q, safe(() => session.getItem(FLOW_KEY)));
safe(() => session.removeItem(FLOW_KEY));
const MAPS = listPlugins(PLUGIN_KIND.MAP);
let options = GOLDEN || boot.golden ? { ...DEFAULT_OPTIONS } : loadOptions(storage);
let LANG = LANG_PARAM ?? options.lang;
let settings = boot.settings;
if (boot.kind === "frontend") {
  settings = await runFrontEnd({ maps: MAPS, options, storage, screen: boot.screen, settings: boot.settings, golden: boot.golden,
    onOptions(o) { options = o; LANG = LANG_PARAM ?? o.lang; } });
}
const MATCH = settings ? settingsToMatch(settings, getMap(settings.map) ?? MAPS[0]) : { map: getMap(TB1.map), seed: SEED, slots: tb1Slots() };
const sim = createSim({ map: MATCH.map, seed: MATCH.seed, slots: MATCH.slots, hooks: { onReady(api) { debugSimApi = api; } } });
const mapDef = MATCH.map;
const ME_IS_AI = MATCH.slots[ME]?.controller === "ai";
let view = sim.state;
// Goldens/demos never read or write a real career. URL overrides are ephemeral fixtures.
const profileParam = ["0", "3", "10"].includes(q.get("profile")) ? Number(q.get("profile")) : null;
const fixtureProfile = profileParam ?? (GOLDEN || DEMO ? (settings?.profile === 0 ? 0 : 10) : null);
let progression = createProgression({
  profile: fixtureProfile === null ? loadProfile(storage) : profileForMatch(fixtureProfile),
  storage: fixtureProfile === null && !ME_IS_AI ? storage : null,
  matchOverride: settings?.profile === 0 ? 0 : null,
});
let wallHit = false, showJobs = false, previousBuildMode = BUILD.NONE, previousHits = 0, previousShots = 0;
let toast = null;
let moraleReason = null;
let prev = capture(view);
let lastEvents = [];
const battleFeedback = createBattleFeedback(ME);
const initialWalls = [];
{
  const p = view.castles[ME].plot;
  for (let i = 0; i < p.type.length; i++) if (p.type[i] === 1) initialWalls.push({ block: 1,
    cell: [i % p.width, Math.floor(i / (p.width * p.depth)), Math.floor(i / p.width) % p.depth] });
}
let lastShotWeapon = null, battleNotice = null, feedbackPose = null;
let triageUsed = false;
const idleEvents = new Map();

function capture(s) {
  return {
    rulers: new Map(s.rulers.map((r) => [r.slot, { ...r.pos }])),
    projectiles: new Map(s.projectiles.map((p) => [p.id, { ...p.pos }])),
    npcs: new Map(s.npcs.map((n) => [n.id, { ...n.pos }])),
  };
}
const lerp3 = (a, b, k) => (a ? [a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k] : [b.x, b.y, b.z]);

/* ------------------------------------------------------------------ renderer */
const biome = getView("biome", "forest");
const sunDir = biome?.sun?.direction ? [...biome.sun.direction] : [-0.55, 0.7, 0.45];
const r = createRenderer({ biome: "forest", sunDir, style: readStyle(q, GOLDEN ? null : storage), golden: GOLDEN }); // style= URL overrides the saved options style
document.body.appendChild(r.domElement);
const camera = r.camera;

const sky = createSky({ seed: MATCH.seed });
r.scene.add(sky.mesh);
r.onBeforeRender((cam) => sky.follow(cam));
const terrain = createTerrainView({ field: view.terrain, biome: "forest" });
r.scene.add(terrain.group);

// Render-side mirror plots: the sim hands out snapshots, so the chunk mesher keeps its own copies.
const mirrors = view.castles.map((c) => c.plot);

const assets = createAssets();
const KIT_PARAM = q.get("kit") ?? "v1";
let models = null, variants = [], material = null, kit = "fallback", kitError = null, kitData = null;
if (KIT_PARAM !== "none") {
  const dir = KIT_PARAM === "0" || KIT_PARAM === "v0" ? "kit-v0" : "kit-v1";
  try {
    kitData = await assets.loadBlockKit(`/assets/${dir}/`);
    models = kitData.models; variants = kitData.variants;
    material = new THREE.MeshLambertMaterial({ map: kitData.atlas, vertexColors: true });
    kit = dir;
  } catch (e) { kitError = String(e); }
}
if (!models) { models = fallbackModels(); material = new THREE.MeshLambertMaterial({ vertexColors: true }); }
const chunks = createChunkManager({ models: createModelSet(models, variants), material, meshOpts: { sunDir } });
for (const p of mirrors) chunks.addPlot(p);
chunks.flush();
r.scene.add(chunks.group);

const ghosts = createGhostView({ scene: r.scene });
const weaponViews = new Map();
function ensureWeaponView(w) {
  if (weaponViews.has(w.id)) return weaponViews.get(w.id);
  const kitCannon = kitData?.weapons?.[w.defId];
  const wv = createWeaponView(kitCannon ? { model: kitCannon.clone(true) } : {});
  wv.root.position.set(w.pos.x, w.pos.y, w.pos.z);
  r.scene.add(wv.root);
  weaponViews.set(w.id, wv); return wv;
}
for (const w of view.weapons) ensureWeaponView(w);
function elevationOf(w) { return fixedElevation(getWeapon(w.defId)); }

const SLOT_COLORS = ["#c02828", "#2860c0", "#28a040", "#c0a020"];
const people = createPeopleView({ scene: r.scene, model: kitData?.people?.person ?? null });
const RULER_TINT = [0xe03030, 0x3070e0, 0x30b050, 0xe0c030];

const ballGeo = new THREE.SphereGeometry(0.3, 10, 8), ballMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2c });
const balls = new Map();
const fx = createFx({ scene: r.scene, seed: MATCH.seed });

/* ------------------------------------------------------------------ HUD, audio, input */
const hudCanvas = document.createElement("canvas");
Object.assign(hudCanvas.style, { position: "absolute", left: "0", top: "0", pointerEvents: "none" });
document.body.appendChild(hudCanvas);
const hud = createHud(hudCanvas);
function sizeHud() { hudCanvas.width = globalThis.innerWidth; hudCanvas.height = globalThis.innerHeight; }
sizeHud();
globalThis.addEventListener("resize", sizeHud);
const log = createMessageLog({ max: T.ui.messageMax, ttlTicks: T.ui.messageLifetimeS * K.TICK_HZ });
function announceUnlock() {
  if (toast && view.tick < toast.until) return;
  const concept = progression.takeAnnouncement();
  if (!concept) return;
  const key = `new${concept[0].toUpperCase()}${concept.slice(1)}`;
  const text = t(key, LANG);
  log.push(text, { tick: view.tick, tone: TONE.GOOD });
  const shortKey = { triage: "repairHint", placement: "placementHint", autoFire: "autoFireHint", orders: "shelterHint", catapult: "catapultFound" }[concept] ?? key;
  toast = { key: shortKey, until: view.tick + 6 * K.TICK_HZ };
}
announceUnlock();
const sfx = createSfx();
const craters = [];
let menu = null;

const el = r.domElement;
const toLogical = (x, y) => { const b = el.getBoundingClientRect(); return { x: (x - b.left) / b.width * T.render.logicalW, y: (y - b.top) / b.height * T.render.logicalH }; };
const input = createInput({ element: el, toLogical, slot: ME, features: () => progression.features, blockIds: listPlugins(PLUGIN_KIND.BLOCK).filter(b => b.id !== 0 && !b.mapOnly && b.cost !== null).map(b => b.id), weaponDefs: WEAPON_ORDER.filter(id => weaponAvailable(getWeapon(id))), sensitivity: options.sensitivity });
input.setLook(Math.PI / 2, 0); // face the enemy (east)
const unlockAudio = () => { sfx.unlock(); };
globalThis.addEventListener("pointerdown", unlockAudio);
globalThis.addEventListener("keydown", unlockAudio);
sfx.setVolume(options.volume / 10);

/* ------------------------------------------------------------------ in-match menus (pause, end screen) */
function openMenu(screen, extra = {}) {
  if (menu && menu.screen === SCREEN.OVER) return;
  menu = createMenu({ maps: MAPS, screen, settings: settings ?? defaultSettings(MAPS), options: { ...options, lang: LANG }, ...extra });
  input.unlock(); input.blur();
}
/** Leave the page for the title menu or the setup screen (URL params would otherwise re-boot a match). */
function navigate(next) {
  safe(() => session.setItem(FLOW_KEY, flowRecord(next, settings ?? defaultSettings(MAPS))));
  globalThis.location.href = globalThis.location.pathname;
}
function handleMenuEvent(ev) {
  if (!ev) return;
  if (ev.type === MENU_EVENT.RESUME) { menu = null; input.blur(); input.sample({}); }
  else if (ev.type === MENU_EVENT.RESTART) { if (settings) navigate("match"); else globalThis.location.reload(); }
  else if (ev.type === MENU_EVENT.TITLE) navigate("main");
  else if (ev.type === MENU_EVENT.SETUP) navigate("skirmish");
  else if (ev.type === MENU_EVENT.OPTIONS) {
    options = ev.options; if (!GOLDEN) saveOptions(storage, options);
    LANG = LANG_PARAM ?? options.lang; input.setSensitivity(options.sensitivity); sfx.setVolume(options.volume / 10);
    if (!GOLDEN && !DEMO) follow.setEnabled(options.followCam);
  }
}
globalThis.addEventListener("keydown", (e) => {
  if (!menu || GOLDEN) return;
  e.preventDefault(); e.stopImmediatePropagation();
  handleMenuEvent(menu.key(e.code));
}, true);
for (const type of ["mousedown", "mousemove"]) {
  globalThis.addEventListener(type, (e) => {
    if (!menu || GOLDEN) return;
    e.stopPropagation();
    const p = toLogical(e.clientX, e.clientY);
    const ev = menu.pointer(p.x, p.y, type === "mousedown" && e.button === 0);
    handleMenuEvent(ev);
  }, true);
}
let wasLocked = false;
document.addEventListener("pointerlockchange", () => {
  const locked = document.pointerLockElement === el;
  if (!locked && wasLocked && !menu && !GOLDEN && !view.outcome && cameraMode() === CAMERA_MODE.WALK) openMenu(SCREEN.PAUSE);
  wasLocked = locked;
});

const rig = createCameraRig(camera, { seed: MATCH.seed, golden: GOLDEN || DEMO });
/* First-person feel (src/player/feel.js): stepped per sim tick from sim state and events, sampled per frame. */
const feel = createFeel({ seed: MATCH.seed, bob: !GOLDEN && (!DEMO || DEMO_FEEL) });
const follow = createFollow({ enabled: GOLDEN || (DEMO && !DEMO_FEEL) ? false : DEMO_FEEL || options.followCam });
const bubbles = createBubbles();
let lastBand = moraleBand(view.castles[ME].morale).index;
const WP = (id) => view.weapons.find((x) => x.id === id) ?? null;
function blastRadius(weaponId) { const w = WP(weaponId), d = w ? getWeapon(w.defId) : null; return d ? Math.max(d.shot.splashRadius, d.shot.radius) : 1.25; }
function camDist(pos) { return Math.hypot(pos[0] - camera.position.x, pos[1] - camera.position.y, pos[2] - camera.position.z); }
function cellWorld(plotId, cell) { const o = view.castles[plotId].plot.origin; return [o.x + cell[0] + 0.5, o.y + cell[1] + 0.5, o.z + cell[2] + 0.5]; }
/** Feel, follow cam, bubbles and morale bell from one tick's events. */
function feelEvents(events) {
  for (const e of events) {
    const p = e.payload;
    if (e.type === EV.SHOT_FIRED && p.slot === ME) {
      const w = WP(p.weaponId);
      if (w && mannedWeapon()?.id === w.id) {
        feel.ownShot(getWeapon(w.defId).traj === "lobbed" ? "throw" : "hard");
        const mine = view.projectiles.filter((x) => x.sourceSlot === ME);
        if (mine.length) follow.start(Math.max(...mine.map((x) => x.id)));
      }
    } else if (e.type === EV.IMPACT) {
      feel.impact(blastRadius(p.weaponId), camDist(p.pos));
      if (p.slot === ME) follow.impact(p.pos);
    } else if (e.type === EV.MAGAZINE_EXPLODED) feel.impact(4, camDist(cellWorld(p.plot, p.cell)));
    else if (e.type === EV.COLLAPSE && p.cells?.length) feel.impact(2, camDist(cellWorld(p.plot, p.cells[0])));
    else if (e.type === EV.MORALE_BAND && p.castle === ME) {
      if (lastBand !== null && p.band > lastBand && !GOLDEN) sfx.bell();
      lastBand = p.band;
    }
  }
  bubbles.onEvents(events, view, { slot: ME, lang: LANG });
}
let script = DEMO ? (SCRIPTS[q.get("demo")] ?? SCRIPTS.tb1)() : null;

/**
 * TB2 demo director (demo=tb2): once the enemy gun has its crew and is loaded, slot 1 aims at our east wall by the
 * stairs and fires (the AI's own FIRE is dropped while its crew is still walking, see the TB2 report); after the
 * impact the camera leaves the weapon view for a free camera over the damage so the masons can be seen arriving.
 */
const TB2_DIRECTOR = Object.freeze({ enemyWeaponIndex: 0, ourWallLocal: [40.5, 5, 31.5], camLocal: [40, 12, 20], camAzDeg: 209, camPitchDeg: -41, linger: 30 });
const director = { stage: 0, impactTick: null };
function directorCommands() {
  if (!DEMO_TB2 || view.outcome) return [];
  const enemyGun = view.weapons.filter((w) => w.slot === 1)[TB2_DIRECTOR.enemyWeaponIndex];
  const out = [];
  if (director.stage === 0 && view.tick >= 380 && (enemyGun.crewPresent ?? 0) >= 2 && enemyGun.reload + 1e-9 >= getWeapon(enemyGun.defId).reloadS) {
    const o = view.castles[ME].plot.origin, w = TB2_DIRECTOR.ourWallLocal;
    const a = solveAim(enemyGun.pos, { x: o.x + w[0], y: o.y + w[1], z: o.z + w[2] }, windVector(view.wind));
    out.push({ type: CMD.AIM, slot: 1, weaponId: enemyGun.id, az: a.az, range: a.range });
    director.stage = 1;
  } else if (director.stage === 1) {
    out.push({ type: CMD.FIRE, slot: 1, weaponId: enemyGun.id });
    director.stage = 2;
  } else if (director.stage === 2 && director.impactTick !== null && view.tick >= director.impactTick + TB2_DIRECTOR.linger) {
    const o = view.castles[ME].plot.origin, c = TB2_DIRECTOR.camLocal;
    freeCamera = { pos: [o.x + c[0], o.y + c[1], o.z + c[2]], yaw: TB2_DIRECTOR.camAzDeg * DEG, pitch: TB2_DIRECTOR.camPitchDeg * DEG, roll: 0, fov: T.ruler.fovDeg };
    director.stage = 3;
  }
  return out;
}
let freeCamera = null; // explicit debug pose overrides the rig
const queued = [];
let impactHeld = false, freeLook = { yaw: 0, pitch: 0 };

/* ------------------------------------------------------------------ tick */
function ownWeaponsAabbs() {
  return view.weapons.filter((w) => w.hp > 0).map((w) => ({ defId: w.defId, id: w.id, slot: w.slot, crewOrdered: w.crewOrdered,
    min: [w.pos.x - 0.5, w.pos.y, w.pos.z - 0.5], max: [w.pos.x + 0.5, w.pos.y + 1, w.pos.z + 0.5] }));
}

function cameraMode() {
  const me = view.rulers[ME];
  if (me.hp <= 0) return CAMERA_MODE.DEATH;
  if (follow.active) return CAMERA_MODE.IMPACT;
  if (me.manning !== null && me.manning !== undefined) return impactHeld && mannedWeapon()?.lastImpact ? CAMERA_MODE.IMPACT : CAMERA_MODE.WEAPON;
  return CAMERA_MODE.WALK;
}
const mannedWeapon = () => { const m = view.rulers[ME].manning; return m === null || m === undefined ? null : view.weapons.find((w) => w.id === m) ?? null; };

/** The same reticle/site query feeds input, preview, HUD and the debug evidence hook. */
function constructionContext(sample = null) {
  const me = view.rulers[ME], castle = view.castles[ME];
  let build = sample?.build ?? script?.build ?? input.build;
  const f = progression.features;
  if (build.mode === BUILD.WEAPON && (!f.placement || !f.weapons.includes(build.weapon)) ||
      build.mode === BUILD.BLOCK && !f.blocks.includes(build.block)) build = { ...build, mode: BUILD.NONE };
  const aim = sample?.look ?? script?.look?.(view) ?? input.look;
  const target = mannedWeapon() ? null : pick({ eye: [me.pos.x, me.pos.y + T.ruler.eye, me.pos.z], ...aim, slot: ME,
    plots: view.castles.map(c => ({ plot: c.plot, slot: c.slot })), weapons: ownWeaponsAabbs() });
  const def = build.mode === BUILD.WEAPON ? getWeapon(build.weapon) : getBlock(build.block);
  const g = cameraMode() === CAMERA_MODE.WALK && build.mode !== BUILD.NONE && def ? ghost({
    target, plot: castle.plot, slot: ME, yaw: aim.yaw, gold: castle.gold,
    openDesignations: castle.npcDesignations?.length ?? 0,
    people: [...view.rulers, ...view.npcs], weapons: view.weapons,
    weaponCount: view.weapons.filter(w => w.slot === ME && w.hp > 0).length + (castle.npcDesignations ?? []).filter(d => d.weapon).length,
    weaponCap: mapDef.weaponCap, build: { ...build, cost: def.cost, footprint: def.footprint, mount: def.mount },
  }) : null;
  return { target, ghost: g, build, def, plot: castle.plot };
}
function playerCommands() {
  input.setMode(cameraMode());
  const w = mannedWeapon();
  const s = input.sample({ weapon: w ? { id: w.id, defId: w.defId, az: w.aim.az, range: w.aim.range, autoFire: w.autoFire, crewOrdered: w.crewOrdered } : null,
    shelterOn: view.castles[ME].shelter });
  const c = constructionContext(s); s.target = c.target; s.ghost = c.ghost;
  if (s.build.mode === BUILD.BLOCK && previousBuildMode !== BUILD.BLOCK && wallHit) progression.usePrompt("build");
  previousBuildMode = s.build.mode;
  showJobs = !!s.showJobs;
  impactHeld = !!s.impactHeld;
  freeLook = s.freeLook || freeLook;
  if (s.menu && !GOLDEN) { openMenu(SCREEN.PAUSE); return []; }
  if (ME_IS_AI) return []; // slot 0 set to a computer level in the setup: watch only
  return buildCommands(s, view.tick);
}

function tick(forcePlayer = false) {
  if (view.outcome || (menu && !GOLDEN)) return;
  prev = capture(view);
  let cmds = forcePlayer === true ? playerCommands() : script ? script.next(view) : GOLDEN ? [] : playerCommands();
  for (const c of directorCommands()) queued.push(c);
  for (const c of queued.splice(0)) {
    const slot = c.slot ?? ME;
    cmds.push({ ...c, slot, tick: view.tick, seq: cmds.filter((x) => x.slot === slot).length });
  }
  const previousManning = view.rulers[ME].manning;
  sim.tick(cmds);
  const events = sim.drainEvents();
  view = sim.state;
  if (cmds.some(c => c.slot === ME && c.type === CMD.REPAIR_PRIORITY && view.castles[ME].jobs?.some(j =>
    j.kind === "repair" && j.priority > 0 && j.target.cell?.every((n, i) => n === c.cell[i])))) triageUsed = true;
  const man = cmds.find(c => c.slot === ME && c.type === CMD.MAN_WEAPON);
  if (man && previousManning !== man.weaponId && view.rulers[ME].manning === man.weaponId) progression.usePrompt("man");
  if (cmds.some(c => c.slot === ME && c.type === CMD.FIRE) && (view.castles[ME].stats?.shots ?? 0) > previousShots) progression.usePrompt("fire");
  handleEvents(events);
  feelEvents(events);
  feel.step({ ruler: view.rulers[ME] });
  follow.step(view);
  if (!GOLDEN && view.tick % 15 === 0) sfx.setAmbience({ windSpeed: view.wind.speed, population: view.castles[ME].population });
  fx.update(K.DT);
  for (const p of view.projectiles) fx.trail(new THREE.Vector3(p.pos.x, p.pos.y, p.pos.z));
}

function handleEvents(events) {
  lastEvents = events;
  // SHOT_FIRED's legacy payload has no projectile ID. Match newly public IDs in launch order,
  // including a projectile that hit in its launch tick, so overlapping flights retain their own aim.
  const launched = new Map();
  const newIds = [...view.projectiles.filter(p => p.sourceSlot === ME && !prev.projectiles.has(p.id)).map(p => ({ id: p.id, weaponId: p.weaponId })),
    ...events.filter(e => e.type === EV.IMPACT && e.payload.slot === ME && Number.isInteger(e.payload.projectileId) && !prev.projectiles.has(e.payload.projectileId))
      .map(e => ({ id: e.payload.projectileId, weaponId: e.payload.weaponId }))].sort((a,b) => a.id-b.id);
  for (const projectile of newIds) { if (!launched.has(projectile.weaponId)) launched.set(projectile.weaponId, []); launched.get(projectile.weaponId).push(projectile.id); }
  for (const e of events) if (e.type === EV.SHOT_FIRED && e.payload.slot === ME) {
    const p = e.payload, w = WP(p.weaponId);
    if (w) {
      const fired = { ...w, aim: w.lastAim ?? w.aim };
      predicted(fired);
      battleFeedback.shot({ weaponId: w.id, projectileId: p.projectileId ?? launched.get(w.id)?.shift(), origin: p.pos,
        aimPoint: predictedCache.point, aim: fired.aim }, view.tick);
      lastShotWeapon = w.id;
    }
  }
  const feedback = battleFeedback.ingest(events, view);
  for (const notice of feedback.notices) battleNotice = { key: notice, until: view.tick + 6 * K.TICK_HZ };
  if (feedback.sound && !GOLDEN) sfx.play(EV.RULER_THREAT);
  const touched = new Set();
  for (const e of events) {
    const p = e.payload;
    if (p.plot === ME && (e.type === EV.BLOCK_DAMAGED || e.type === EV.BLOCK_DESTROYED) && [1, 2, 12].includes(p.id)) {
      const m = mirrors[ME], i = p.cell[0] + m.width * p.cell[2] + m.width * m.depth * p.cell[1];
      if (e.type === EV.BLOCK_DESTROYED || p.hp < m.hp[i]) wallHit = true;
    }
    if (e.type === EV.WEAPON_IDLE && p.castle === ME) idleEvents.set(p.weaponId, { idleReason: p.reason, detail: p.detail });
    if (e.type === EV.JOB_CREATED && p.castle === ME && p.kind === "repair" && view.castles[ME].jobs?.some(j => j.id === p.jobId && j.priority > 0)) triageUsed = true;
    if (e.type === EV.DESIGNATION_ADDED && p.slot === ME) triageUsed = true;
    if (e.type === EV.NPC_DIED && p.castle === ME) moraleReason = { key: "moraleLoss", tick: view.tick };
    else if (e.type === EV.BLOCK_DAMAGED && p.plot === ME) moraleReason = { key: "moraleDamage", tick: view.tick };
    else if (e.type === EV.IMPACT && p.slot === ME && p.hit !== "terrain") moraleReason = { key: "moraleRally", tick: view.tick };
    if (e.type === EV.MORALE_BAND && p.castle === ME && progression.features.hud.morale) {
      const band = moraleBand(p.morale, LANG);
      const recent = moraleReason && view.tick - moraleReason.tick < 20 * K.TICK_HZ;
      const rising = band.index < lastBand;
      const fits = recent && (rising ? moraleReason.key === "moraleRally" : moraleReason.key !== "moraleRally");
      const reason = fits ? moraleReason.key : rising ? "moraleQuiet" : "moraleStrain";
      log.push(`${t("moraleStatus", LANG, { band: band.name })}: ${t(reason, LANG)}`, { tick: view.tick, tone: TONE.INFO });
    }
    if (e.type === EV.BLOCK_DAMAGED || e.type === EV.BLOCK_DESTROYED || e.type === EV.BLOCK_BUILT) touched.add(p.plot), chunks.markCell(mirrors[p.plot], ...p.cell);
    else if (e.type === EV.DESIGNATION_ADDED || e.type === EV.DESIGNATION_CANCELLED) touched.add(p.slot);
    else if (e.type === EV.COLLAPSE) { touched.add(p.plot); for (const c of p.cells) chunks.markCell(mirrors[p.plot], ...c); }
    else if (e.type === EV.SHOT_FIRED) {
      fx.muzzleFlash(new THREE.Vector3(...p.pos));
      log.push(t(p.slot === ME ? "shotFired" : "enemyFires", LANG), { tick: view.tick, tone: p.slot === ME ? TONE.INFO : TONE.BAD });
    } else if (e.type === EV.IMPACT) {
      fx.impactPuff(new THREE.Vector3(...p.pos));
      if (p.slot !== ME && director.impactTick === null && director.stage >= 2) director.impactTick = view.tick;
      if (p.slot === ME) {
        const enemy = view.castles[1 - ME], o = enemy.plot.origin;
        const inside = p.pos[0] >= o.x && p.pos[0] < o.x + enemy.plot.width && p.pos[2] >= o.z && p.pos[2] < o.z + enemy.plot.depth;
        if (inside && p.hit !== "terrain") {
          craters.push({ x: p.pos[0] - o.x, z: p.pos[2] - o.z, r: 1.5 });
          const impact = battleFeedback.impact(p.weaponId, view.tick);
          log.push(t(impact?.kind === "palace" ? "impactPalace" : p.hit === "block" ? "impactWall" : "impactGun", LANG), { tick: view.tick, tone: TONE.GOOD });
        } else log.push(t("miss", LANG), { tick: view.tick, tone: TONE.INFO });
      }
    } else if (e.type === EV.CASTLE_ELIMINATED && p.slot === ME && !view.outcome) {
      if (!ME_IS_AI) progression.finish(false);
      openMenu(SCREEN.OVER, { result: resultFor({ ...view, outcome: { winners: [], draw: false, tick: view.tick } }) });
    } else if (e.type === EV.GAME_OVER) {
      if (!ME_IS_AI) progression.finish(!p.draw && (p.winners ?? []).includes(ME));
      openMenu(SCREEN.OVER, { result: resultFor(view) });
    }
  }
  const shots = view.castles[ME].stats?.shots ?? 0;
  const cannonShots = events.filter(e => e.type === EV.SHOT_FIRED && e.payload.slot === ME && WP(e.payload.weaponId)?.defId === "cannon").length;
  for (let i = 0; i < shots - previousShots; i++) progression.shot(i < cannonShots ? "cannon" : "other");
  previousShots = shots;
  const hits = view.castles[ME].stats?.directHits ?? 0;
  if (hits > previousHits) progression.hit(hits - previousHits);
  previousHits = hits;
  announceUnlock();
  for (const id of touched) {
    const src = view.castles[id].plot, m = mirrors[id];
    m.type.set(src.type); m.hp.set(src.hp); m.meta.set(src.meta);
  }
  for (const m of [...eventsToMessages(events, { lang: LANG, slot: ME }), ...designationMessages(events, { lang: LANG, slot: ME })]) log.push(m.text, { tick: view.tick, tone: m.tone });
  if (!GOLDEN) sfx.handle(events.filter(e => e.type !== EV.RULER_THREAT), { pos: [camera.position.x, camera.position.y, camera.position.z], yaw: -camera.rotation.y });
}

function resultFor(state) {
  const result = matchResult(state, ME, settings);
  if (!result.won && !result.draw) result.account = lossAccount(state, ME, battleFeedback, {
    lang: LANG, nameOf: slot => result.rows.find(row => row.slot === slot)?.name,
    weaponName: (id, defId) => getWeapon(defId ?? WP(id)?.defId)?.name?.[LANG] ?? t("enemyWeapon", LANG),
  });
  return result;
}

/* ------------------------------------------------------------------ render */
let lastFrameMs = null;
function frame(alpha) {
  const now = globalThis.performance.now();
  const dt = lastFrameMs === null ? K.DT : Math.min(0.25, (now - lastFrameMs) / 1000);
  lastFrameMs = now;
  const me = view.rulers[ME];
  const mode = cameraMode();
  const figures = [];
  for (const ru of view.rulers) {
    const visible = ru.hp > 0 && (ru.slot !== ME || mode === CAMERA_MODE.DEATH || mode === CAMERA_MODE.GHOST || freeCamera !== null && freeCamera.showRuler !== false);
    if (visible) figures.push({ id: -1 - ru.slot, pos: lerp3(prev.rulers.get(ru.slot), ru.pos, alpha), prev: prev.rulers.get(ru.slot), now: ru.pos, role: "ruler", tint: RULER_TINT[ru.slot] });
  }
  for (const n of view.npcs) {
    if (n.hp <= 0 || n.deserted) continue;
    figures.push({ id: n.id, pos: lerp3(prev.npcs.get(n.id), n.pos, alpha), prev: prev.npcs.get(n.id), now: n.pos, role: n.role });
  }
  people.update(figures);
  for (const w of view.weapons) {
    const wv = ensureWeaponView(w);
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
    const scripted = script !== null;
    const scriptedLook = script?.look?.(view);
    const yaw = scriptedLook?.yaw ?? (scripted ? (me.yaw / K.YAW_UNITS) * Math.PI * 2 : input.look.yaw);
    const pitch = scriptedLook?.pitch ?? (scripted ? 0 : input.look.pitch);
    const w = mannedWeapon();
    rig.update({
      mode, dt,
      ruler: { pos: lerp3(prev.rulers.get(ME), me.pos, alpha), yaw, pitch, moving: !scripted },
      weapon: w ? { pivot: [w.pos.x, w.pos.y, w.pos.z], azDeg: w.aim.az / T.aim.azUnitsPerDeg,
        sight: weaponViews.get(w.id)?.nodes.sight.getWorldPosition(new THREE.Vector3()).toArray() } : undefined,
      freeLook,
      impact: w && w.lastImpact ? { point: [w.lastImpact.x, w.lastImpact.y, w.lastImpact.z], azDeg: w.aim.az / T.aim.azUnitsPerDeg } : undefined,
      follow: followCamPose(alpha, w),
      feel: feel.sample(alpha),
      groundY: me.pos.y,
    });
  }
  ghosts.update(view, constructionContext());
  chunks.update(camera.position);
  r.render();
  hud.draw(hudView(mode));
}

/** Impact-view follow cam: ride the ball, then hold on the impact (src/player/feel.js createFollow). */
function followCamPose(alpha, w) {
  const tg = follow.target(alpha);
  if (!tg) return undefined;
  if (tg.pos) return followPose(tg);
  return impactPose({ point: tg.impact, azDeg: w ? w.aim.az / T.aim.azUnitsPerDeg : 0 });
}

/** Job markers and speech bubbles of own NPCs, projected to logical HUD pixels. */
const ovV = new THREE.Vector3();
function overlays(mode) {
  if (mode === CAMERA_MODE.DEATH) return null;
  const out = { markers: [], bubbles: [] };
  const f = progression.features;
  const jobKind = new Map((view.castles[ME].jobs ?? []).map((j) => [j.id, j.kind]));
  const project = (x, y, z) => {
    ovV.set(x, y, z).project(camera);
    if (ovV.z >= 1 || ovV.z <= -1 || Math.abs(ovV.x) > 1.05 || Math.abs(ovV.y) > 1.05) return null;
    return [Math.round((ovV.x + 1) / 2 * T.render.logicalW), Math.round((1 - ovV.y) / 2 * T.render.logicalH)];
  };
  for (const n of view.npcs) {
    if (n.slot !== ME || n.hp <= 0 || n.deserted) continue;
    const d = camDist([n.pos.x, n.pos.y, n.pos.z]);
    if (d > 45) continue;
    const icon = npcMarker(n, jobKind.get(n.jobId) ?? null);
    if (!icon) continue;
    const s = project(n.pos.x, n.pos.y + 2.25, n.pos.z);
    if (s && ((f.hud.jobs && showJobs) || icon === "flame" || icon === "bed")) out.markers.push({ x: s[0], y: s[1], icon, scale: d < 20 ? 1 : 0.8 });
  }
  for (const b of bubbles.visible(view.tick)) {
    const n = view.npcs.find((x) => x.id === b.entityId);
    if (!n || camDist([n.pos.x, n.pos.y, n.pos.z]) > 60) continue;
    const s = project(n.pos.x, n.pos.y + 2.6, n.pos.z);
    if (s) out.bubbles.push({ x: s[0], y: s[1], text: b.text });
  }
  return out;
}

const predictedCache = { key: null, point: null };
function predicted(w) {
  const key = `${w.id}:${w.aim.az}:${w.aim.range}`;
  if (predictedCache.key !== key) {
    const def = getWeapon(w.defId), az = w.aim.az / T.aim.azUnitsPerDeg;
    const res = traceFlight({ ...def, v0: def.v0, charge: w.aim.range / T.aim.rangeUnitsPerDial, k: def.k, elevation: elevationOf(w), azimuth: az, pos: { x: w.pos.x, y: w.pos.y + 0.5, z: w.pos.z }, landingY: w.pos.y });
    predictedCache.key = key; predictedCache.point = res.pos;
  }
  const v = new THREE.Vector3(predictedCache.point.x, predictedCache.point.y, predictedCache.point.z).project(camera);
  return [Math.round((v.x + 1) / 2 * T.render.logicalW), Math.round((1 - v.y) / 2 * T.render.logicalH)];
}

function flatRange(w) {
  predicted(w);
  return Math.hypot(predictedCache.point.x - w.pos.x, predictedCache.point.z - w.pos.z);
}

const minimapCache = { tick: -1, own: null, enemy: null };
const interventionCache = { key: null, choices: [] };
function projectFeedback(pos) {
  const v = new THREE.Vector3(...pos).project(camera);
  if (v.z <= -1 || v.z >= 1 || Math.abs(v.x) > .96 || Math.abs(v.y) > .92) return null;
  const y = Math.round((1 - v.y) / 2 * K.LOGICAL_H);
  return y < 540 ? [Math.round((v.x + 1) / 2 * K.LOGICAL_W), y] : null;
}
const feedbackRay = new THREE.Raycaster();
function visibleFeedback(pos, kind) {
  const point = projectFeedback(pos);
  if (!point || point[1] < 200 || point[1] > 500) return false;
  if (kind === "crew") return true;
  const direction = new THREE.Vector3(...pos).sub(camera.position), distance = direction.length();
  feedbackRay.set(camera.position, direction.normalize()); feedbackRay.near = .05; feedbackRay.far = Math.max(.05, distance - .1);
  return !feedbackRay.intersectObjects([...weaponViews.values()].filter(w => w.root.visible).map(w => w.root), true).length;
}
function workFeedback() {
  const eye = view.rulers[ME].pos, from = { ...eye, y: eye.y + T.ruler.eye };
  return readableWork(localWorkProgress(view, ME).filter(job => {
    if (Math.hypot(job.pos[0] - eye.x, job.pos[1] - eye.y, job.pos[2] - eye.z) > 24) return false;
    const hit = raycast(view.castles[ME].plot, from, { x: job.pos[0], y: job.pos[1], z: job.pos[2] });
    return !hit || [hit.cell.x, hit.cell.y, hit.cell.z].every((v, i) => v === job.cell[i]);
  }).filter(job => visibleFeedback(job.pos)).map(job => ({ ...job, screen: projectFeedback(job.pos) })).filter(job => job.screen));
}
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
  const c = constructionContext();
  const selection = !w && c.build.mode !== BUILD.NONE && c.def ? { name: c.def.name[LANG], cost: c.def.cost, valid: c.ghost?.valid ?? false } : null;
  const threat = battleFeedback.danger(view.tick);
  const reloadGun = w ?? WP(lastShotWeapon);
  const reloading = reloadGun?.hp > 0 && reloadGun.reload < getWeapon(reloadGun.defId).reloadS;
  const teachDamage = wallHit && !triageUsed && progression.profile.promptUses.build < 2;
  const needsChoices = !ME_IS_AI && !selection && (reloading || teachDamage || threat);
  const key = `${Math.floor(view.tick / 10)}:${mode}:${progression.features.match}:${camera.rotation.y.toFixed(2)}:${camera.rotation.x.toFixed(2)}:${needsChoices}:${!!threat}`;
  if (interventionCache.key !== key) {
    interventionCache.key = key;
    interventionCache.choices = needsChoices ? localInterventions(view, ME, { features: progression.features,
      blueprint: initialWalls, threatened: !!threat, visible: visibleFeedback }) : [];
  }
  const choices = interventionCache.choices;
  const focusGun = w ?? (c.target?.own && c.target.kind === "weapon" ? WP(c.target.weaponId) : null);
  const focusReason = focusGun?.idleReason ?? idleEvents.get(focusGun?.id)?.idleReason;
  const diagnosis = w && focusReason === "reloading" ? null : idleDiagnosis(focusGun ? { ...idleEvents.get(focusGun.id), ...focusGun } : null,
    { lang: LANG, features: progression.features, distance: w ? 0 : c.target?.dist, manned: !!w });
  const impact = battleFeedback.impact(w?.id ?? lastShotWeapon, view.tick);
  const reference = battleFeedback.reference(w?.id ?? lastShotWeapon);
  const learning = contextualPrompt(progression.profile, { mode, target: c.target, wallHit: false, building: c.build.mode !== BUILD.NONE,
    loaded: !!w && w.reload + 1e-9 >= def.reloadS, affordable: !!w && meC.gold >= def.fireCost, hasAmmo: !!w && w.ammo >= def.ammoLoads }, LANG);
  const preferDiagnosis = diagnosis && focusReason !== "reloading" && !threat;
  const guidance = choices.length && !preferDiagnosis ? { lines: choices.map(a => interventionText(a, LANG, !!w)),
    leave: !!w && choices.some(a => a.kind !== "cover" && (a.kind !== "crew" || a.weaponId !== w.id)),
    markers: choices.filter(a => a.pos).map(a => ({ ...a, screen: projectFeedback(a.pos) })).filter(a => a.screen) } : null;
  const result = {
    lang: LANG, mode, tick: view.tick, features: progression.features,
    incomeRate: T.economy.palaceIncomeS + T.economy.civilianIncomeS * (meC.civiliansWorking ?? 0),
    prompt: guidance ? null : diagnosis ? { id: "idle", text: diagnosis } : learning,
    toast: !threat && battleNotice && view.tick < battleNotice.until ? t(battleNotice.key, LANG) : toast && view.tick < toast.until ? t(toast.key, LANG) : null,
    guidance, work: workFeedback(),
    danger: threat ? { ...threat, text: t("incoming", LANG, { dir: cardinal(threat.bearing ?? bearing, LANG), s: (threat.etaTicks / K.TICK_HZ).toFixed(1) }) } : null,
    palace: palaceStatus(meC, view.tick),
    pressure: progression.features.hud.morale ? pressureText(meC, LANG) : null,
    impactFeedback: impact ? impactText(impact, LANG) : null,
    aimReference: reference && [CAMERA_MODE.WEAPON, CAMERA_MODE.IMPACT].includes(mode) ? {
      text: t("aimReference", LANG, { az: (reference.aim.az / 10).toFixed(1), charge: (reference.aim.range / 10).toFixed(1) }),
      aim: projectFeedback(reference.aimPoint), last: reference.impact || reference.previousImpact ? projectFeedback(reference.impact ?? reference.previousImpact) : null,
    } : null,
    paletteLabel: c.build.mode === BUILD.WEAPON ? t("arsenalHint", LANG, { name: c.def?.name?.[LANG] ?? "" }) : null,
    gold: Math.floor(meC.gold), pop: { now: meC.population, start: meC.initialPopulation },
    weapons: { now: view.weapons.filter((x) => x.slot === ME && x.hp > 0).length, cap: mapDef.weaponCap },
    heading: camYaw,
    wind: { speed: wind.speed, dirDeg: wind.direction, prevDirDeg: wind.previousDirection },
    enemies: [{ bearingDeg: bearing, ally: false, color: SLOT_COLORS[1 - ME] }],
    weapon: w ? {
      name: def.name[LANG], rangeM: flatRange(w), hpPct: (w.hp / def.hp) * 100, az: w.aim.az, range: w.aim.range,
      reload: Math.min(1, w.reload / def.reloadS), loaded: w.reload + 1e-9 >= def.reloadS,
      fireCost: def.fireCost, affordable: meC.gold >= def.fireCost, autoFire: w.autoFire, crewOrdered: w.crewOrdered,
      restoreLit: w.aim.az !== w.lastAim.az || w.aim.range !== w.lastAim.range,
    } : null,
    morale: { value: meC.morale }, selection, reserved: reservedGold(meC), shelterOn: meC.shelter,
    messages: log.visible(view.tick),
    enemyLabel: { title: t("enemy", LANG), name: settings?.slots?.[1 - ME]?.name ?? "KI", castle: getCastle(enemy.defId ?? "default")?.name?.[LANG] ?? "" },
    minimapOwn: minimapCache.own, minimapEnemy: minimapCache.enemy,
    reticle: w && mode === CAMERA_MODE.WEAPON ? { predicted: predicted(w) } : {},
    overlays: overlays(mode),
    castleColor: SLOT_COLORS[ME],
    menu,
  };
  // Visual fixtures override only the HUD view, never the simulation or the player's career.
  return GOLDEN && feedbackPose ? { ...result, ...feedbackPose } : result;
}

/* ------------------------------------------------------------------ loop and debug hook */
const loop = createLoop({
  tick, render: frame,
  maxTicks: Math.ceil(T.sim.maxTicksPerFrame * SPEED), maxFrameDt: T.sim.dtClampS * SPEED, // time-lapse only when speed > 1
  requestFrame: (f) => globalThis.requestAnimationFrame((ms) => f(ms * SPEED)), cancelFrame: (h) => globalThis.cancelAnimationFrame(h),
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
    sim, kit, kitError, chunks, ghosts, hud, input,
    feedback: battleFeedback,
    feedbackEvents(events) {
      if (!GOLDEN) throw new Error("feedbackEvents requires golden mode");
      handleEvents(events); frame(0);
    },
    replayCommands(commands, until) {
      if (!GOLDEN) throw new Error("replayCommands requires golden mode");
      for (const command of commands) { stepTo(command.tick); queued.push({ ...command }); }
      stepTo(until); chunks.flush(); frame(0); return view.tick;
    },
    setProfile(value) {
      progression = createProgression({ profile: typeof value === "number" ? profileForMatch(value) : value ?? freshProfile() });
      toast = null; previousHits = view.castles[ME].stats?.directHits ?? 0; previousShots = view.castles[ME].stats?.shots ?? 0;
      input.blur(); announceUnlock(); frame(0); return progression.features;
    },
    construction: () => constructionContext(), script: () => script,
    /** Drive the exact keyboard/reticle command path while golden time is paused. */
    playerStep() { tick(true); chunks.flush(); frame(0); return view.tick; },
    setBuild(build, aim) { script = null; Object.assign(input.build, build); if (aim) input.setLook(aim.yaw, aim.pitch); frame(0); return constructionContext(); },
    /** Golden fixture: one incoming direct-hit cannonball, through normal flight/collision/damage. */
    enemyShot(cell = TB3.cells[2]) {
      if (!GOLDEN) throw new Error("enemyShot requires golden mode");
      const o = view.castles[ME].plot.origin, def = getWeapon("cannon");
      const weapon = view.weapons.find(w => w.slot !== ME && w.hp > 0);
      const pos = { x: o.x + cell[0] + 6, y: o.y + cell[1] + 0.75, z: o.z + cell[2] + 0.5 };
      const vel = { x: -30, y: 0, z: 0 };
      debugSimApi.spawnProjectile({ pos, vel, radius: def.shot.radius, k: def.k,
        payload: { ...def.shot, splash: 0, splashRadius: 0 }, sourceSlot: weapon.slot, weaponId: weapon.id });
      debugSimApi.emit(EV.SHOT_FIRED, { slot: weapon.slot, weaponId: weapon.id, pos: [pos.x,pos.y,pos.z], vel: [vel.x,vel.y,vel.z] });
      view = sim.state; handleEvents(sim.drainEvents()); frame(0); return true;
    },
    /** Queue a command for the next tick (tick and seq are filled in; slot defaults to 0). */
    issue(cmd) { queued.push({ ...cmd }); return queued.length; },
    /** Start the TB1 script (walk, man, aim, fire) from the current tick. */
    runScript(name = "tb1") { script = SCRIPTS[name](); return true; },
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
  profile: { get: () => progression.profile, enumerable: true },
  features: { get: () => progression.features, enumerable: true },
  onboarding: { get: () => ({ wallHit, prompt: hudView(cameraMode()).prompt, toast: hudView(cameraMode()).toast }), enumerable: true },
  battleHud: { get: () => hudView(cameraMode()), enumerable: true },
});
const lanePose = api.setPose;
/**
 * Golden poses on index.html: { script: 'tb1', until: 'ball-near-enemy' | tick } runs the scripted slice;
 * { tick } steps the sim; { position, yaw, pitch, fov } pins a free debug camera (lane D convention) unless
 * camera: "rig" (the player camera rig decides; position/yaw/pitch then only serve tools/blender, which needs them).
 */
api.setPose = (p) => {
  if (GOLDEN && p.feedback !== undefined) feedbackPose = p.feedback;
  if (p.profile !== undefined) api.setProfile(p.profile);
  if (p.showJobs !== undefined) showJobs = p.showJobs && progression.features.hud.jobs;
  if (p.followCam) follow.setEnabled(true);
  if (SCRIPTS[p.script]) {
    script ??= SCRIPTS[p.script]();
    if (p.until === "ball-near-enemy") api.toFirstShotMidFlight();
    else if (Number.isInteger(p.until)) stepTo(p.until);
  } else if (Number.isInteger(p.tick)) stepTo(p.tick);
  chunks.flush(); // goldens must not depend on how many frames the remesh budget gets
  if (p.position && p.camera !== "rig") { freeCamera = { pos: p.position, yaw: -(p.yaw ?? 0), pitch: p.pitch ?? 0, roll: 0, fov: p.fov ?? T.ruler.fovDeg, showRuler: p.showRuler }; lanePose(p); }
  if (p.matchOver) { // golden end screen: a stubbed outcome over the real stats of the scripted slice
    const result = resultFor({ ...view, outcome: { tick: view.tick, ...p.matchOver } });
    if (GOLDEN && p.account) result.account = p.account;
    openMenu(SCREEN.OVER, { result });
  }
  frame(0);
  return { tick: view.tick, mode: cameraMode() };
};
api.openMenu = (screen) => { openMenu(screen); frame(0); return menu?.screen ?? null; };
api.menuKey = (code) => { if (menu) handleMenuEvent(menu.key(code)); frame(0); return menu?.screen ?? null; };
Object.defineProperty(api, "menu", { get: () => menu, enumerable: true });
api.stepTo = (target) => { stepTo(target); frame(0); return view.tick; };
api.frame = () => frame(0);

frame(0);
if (GOLDEN) {
  const still = () => { frame(0); globalThis.requestAnimationFrame(still); };
  globalThis.requestAnimationFrame(still);
} else loop.start();
api.ready = true;

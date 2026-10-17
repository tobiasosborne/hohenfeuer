// src/player/input.js - owns the browser key/mouse map, pointer lock and per-tick accumulation into input samples.
// IO. Turns DOM events into the InputSample of src/player/commands.js (DESIGN 4.8, 5); the sim never
// sees DOM events, only the integer Commands built from these samples.

import { CAMERA_MODE } from "../contracts.js";
import { TUNING } from "../tuning.js";
import { ACTION, BUILD, AIM_RATE, dragUnits, emptySample } from "./commands.js";
import { hitTest } from "../ui/layout.js";

const PITCH_MAX = TUNING.ruler.pitchClampDeg * Math.PI / 180;
/** Default mouse sensitivity, radians per pixel of pointer-locked movement. */
export const DEFAULT_SENSITIVITY = 0.0022;

const fwd = (s) => ({ axis: ["fwd", s], aim: ["range", s] });
const side = (s) => ({ axis: ["strafe", s], aim: ["az", s] });
/**
 * Key code -> binding. axis: walk move axis; aim: weapon-view tap; hold: held flag;
 * action / weaponAction: edge actions in walk / weapon view; toggle: build mode; digit: block slot.
 */
export const KEYMAP = Object.freeze({
  KeyW: fwd(1), ArrowUp: fwd(1), Numpad8: { aim: ["range", 1] },
  KeyS: fwd(-1), ArrowDown: fwd(-1), Numpad2: { aim: ["range", -1] },
  KeyA: side(-1), ArrowLeft: side(-1), Numpad4: { aim: ["az", -1] },
  KeyD: side(1), ArrowRight: side(1), Numpad6: { aim: ["az", 1] },
  ShiftLeft: { hold: "sprint" }, ShiftRight: { hold: "sprint" },
  ControlLeft: { hold: "ctrl" }, ControlRight: { hold: "ctrl" },
  Space: { hold: "jump", weaponAction: ACTION.FIRE }, Numpad0: { weaponAction: ACTION.FIRE },
  KeyE: { action: ACTION.INTERACT, weaponAction: ACTION.INTERACT },
  KeyQ: { action: ACTION.ORDER_CREW, weaponAction: ACTION.ORDER_CREW },
  KeyR: { action: ACTION.PRIORITY },
  KeyB: { toggle: BUILD.BLOCK }, KeyG: { toggle: BUILD.WEAPON },
  KeyX: { action: ACTION.SHELTER },
  KeyF: { weaponAction: ACTION.AUTO_FIRE },
  Home: { weaponAction: ACTION.RESTORE }, Numpad7: { weaponAction: ACTION.RESTORE },
  End: { hold: "impact" }, Numpad1: { hold: "impact" },
  PageUp: { weaponAction: ACTION.PREV_WEAPON }, Numpad9: { weaponAction: ACTION.PREV_WEAPON },
  PageDown: { weaponAction: ACTION.NEXT_WEAPON }, Numpad3: { weaponAction: ACTION.NEXT_WEAPON },
  Escape: { menu: true, weaponAction: ACTION.LEAVE },
  Tab: { hold: "jobs" },
  ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [`Digit${n}`, { digit: n }])),
});

const isWeaponMode = (m) => m === CAMERA_MODE.WEAPON || m === CAMERA_MODE.IMPACT;

/**
 * @param {{keyTarget?: EventTarget, element: EventTarget & {requestPointerLock?: Function}, doc?: any,
 *   toLogical?: (clientX: number, clientY: number) => {x: number, y: number}, sensitivity?: number,
 *   slot?: number, blockIds?: number[], weaponDefs?: string[]}} o
 */
export function createInput(o) {
  const keyTarget = o.keyTarget || globalThis.window;
  const el = o.element;
  const doc = o.doc || el.ownerDocument || globalThis.document;
  const toLogical = o.toLogical || ((x, y) => ({ x, y }));
  const blockIds = o.blockIds || [1, 2, 4, 5, 6, 7, 8, 9, 10];
  let sensitivity = o.sensitivity ?? DEFAULT_SENSITIVITY;
  let mode = CAMERA_MODE.WALK;
  const keys = new Set();
  const holds = { sprint: false, ctrl: false, jump: false, impact: false, jobs: false };
  let mouseImpact = false;
  let actions = [];
  let menu = false;
  const look = { yaw: 0, pitch: 0 };
  const freeLook = { active: false, yaw: 0, pitch: 0 };
  const aim = { azTaps: 0, rangeTaps: 0, pendX: 0, pendY: 0 };
  let drag = null; // 'dir' | 'range'
  const build = { mode: BUILD.NONE, block: blockIds[0], weapon: (o.weaponDefs || ["cannon"])[0] };

  const locked = () => !!doc && doc.pointerLockElement === el;
  const lock = () => { try { const p = el.requestPointerLock && el.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* headless */ } };
  const unlock = () => { try { if (locked() && doc.exitPointerLock) doc.exitPointerLock(); } catch { /* headless */ } };

  function onKeyDown(e) {
    const b = KEYMAP[e.code];
    if (!b) return;
    if (e.preventDefault && (e.code === "Tab" || e.code === "Space" || e.code.startsWith("Arrow") || e.code.startsWith("Page"))) e.preventDefault();
    keys.add(e.code);
    if (b.hold) holds[b.hold] = true;
    const weapon = isWeaponMode(mode);
    if (weapon && b.aim) { if (b.aim[0] === "az") aim.azTaps += b.aim[1]; else aim.rangeTaps += b.aim[1]; }
    if (e.repeat) return;
    if (weapon) { if (b.weaponAction) actions.push(b.weaponAction); return; }
    if (b.action) actions.push(b.action);
    if (b.menu) menu = true;
    if (b.toggle) build.mode = build.mode === b.toggle ? BUILD.NONE : b.toggle;
    if (b.digit && b.digit <= blockIds.length) build.block = blockIds[b.digit - 1];
  }
  function onKeyUp(e) {
    const b = KEYMAP[e.code];
    keys.delete(e.code);
    if (!b || !b.hold) return;
    const still = Object.entries(KEYMAP).some(([c, k]) => k.hold === b.hold && keys.has(c));
    holds[b.hold] = still;
  }
  function blur() {
    keys.clear();
    for (const k of Object.keys(holds)) holds[k] = false;
    mouseImpact = false; drag = null; freeLook.active = false; freeLook.yaw = 0; freeLook.pitch = 0;
  }
  function onMouseDown(e) {
    if (isWeaponMode(mode)) {
      if (e.button === 2) { freeLook.active = true; return; }
      if (e.button !== 0) return;
      const p = toLogical(e.clientX, e.clientY);
      const hit = hitTest(p.x, p.y, "weapon");
      if (hit === "fire") actions.push(ACTION.FIRE);
      else if (hit === "pad-up") aim.rangeTaps += 1;
      else if (hit === "pad-down") aim.rangeTaps -= 1;
      else if (hit === "pad-left") aim.azTaps -= 1;
      else if (hit === "pad-right") aim.azTaps += 1;
      else if (hit === "readoutDir") drag = "dir";
      else if (hit === "readoutRange") drag = "range";
      else if (hit === "btnL1") actions.push(ACTION.AUTO_FIRE);
      else if (hit === "btnL2") actions.push(ACTION.ORDER_CREW);
      else if (hit === "btnR1") actions.push(ACTION.RESTORE);
      else if (hit === "btnR2") mouseImpact = true;
      else if (hit === "rightColumn") menu = true;
      return;
    }
    if (!locked()) { lock(); return; }
    if (e.button === 0) actions.push(ACTION.PRIMARY);
    else if (e.button === 2) actions.push(ACTION.SECONDARY);
  }
  function onMouseUp(e) {
    if (e.button === 0) { drag = null; mouseImpact = false; }
    if (e.button === 2) { freeLook.active = false; freeLook.yaw = 0; freeLook.pitch = 0; }
  }
  function onMouseMove(e) {
    const mx = e.movementX || 0, my = e.movementY || 0;
    if (isWeaponMode(mode)) {
      if (drag === "dir") aim.pendX += mx;
      else if (drag === "range") aim.pendY += my;
      else if (freeLook.active) {
        freeLook.yaw += mx * sensitivity;
        freeLook.pitch = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, freeLook.pitch - my * sensitivity));
      }
      return;
    }
    if (!locked()) return;
    look.yaw = ((look.yaw + mx * sensitivity) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    look.pitch = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, look.pitch - my * sensitivity));
  }
  function onWheel(e) {
    if (mode !== CAMERA_MODE.WALK || build.mode !== BUILD.BLOCK) return;
    e.preventDefault?.();
    const i = blockIds.indexOf(build.block);
    const n = blockIds.length;
    build.block = blockIds[(i + (e.deltaY > 0 ? 1 : -1) + n) % n];
  }
  const onContext = (e) => { if (e.preventDefault) e.preventDefault(); };

  keyTarget.addEventListener("keydown", onKeyDown);
  keyTarget.addEventListener("keyup", onKeyUp);
  keyTarget.addEventListener("blur", blur);
  el.addEventListener("mousedown", onMouseDown);
  el.addEventListener("mouseup", onMouseUp);
  el.addEventListener("mousemove", onMouseMove);
  el.addEventListener("wheel", onWheel);
  el.addEventListener("contextmenu", onContext);

  const axis = (name) => {
    let v = 0;
    for (const c of keys) { const b = KEYMAP[c]; if (b && b.axis && b.axis[0] === name) v += b.axis[1]; }
    return Math.max(-1, Math.min(1, v));
  };

  return {
    get mode() { return mode; },
    get locked() { return locked(); },
    get build() { return build; },
    get look() { return { ...look }; },
    /** Switch camera mode; weapon view releases pointer lock so the HUD can be clicked. */
    setMode(m) {
      if (m === mode) return;
      mode = m; drag = null; aim.azTaps = 0; aim.rangeTaps = 0; aim.pendX = 0; aim.pendY = 0;
      if (isWeaponMode(m)) unlock();
    },
    setLook(yaw, pitch) { look.yaw = yaw; look.pitch = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, pitch)); },
    setSensitivity(s) { sensitivity = s; },
    lock, unlock, blur,
    /**
     * Drain this tick's input into an InputSample (+ UI extras: impactHeld, showJobs, freeLook, menu).
     * @param {{weapon?: object, target?: object, ghost?: object, shelterOn?: boolean}} ctx
     */
    sample(ctx = {}) {
      const s = emptySample(o.slot ?? 0);
      s.mode = mode;
      const weapon = isWeaponMode(mode);
      if (!weapon) s.move = { fwd: axis("fwd"), strafe: axis("strafe"), sprint: holds.sprint, jump: holds.jump };
      s.look = { yaw: look.yaw, pitch: look.pitch };
      s.actions = actions; actions = [];
      s.ctrl = holds.ctrl;
      const rx = dragUnits(aim.pendX, AIM_RATE.AZ_PER_PX);
      const ry = dragUnits(-aim.pendY, AIM_RATE.RANGE_PER_PX);
      s.aim = { azTaps: aim.azTaps, rangeTaps: aim.rangeTaps, dragX: (aim.pendX - rx.restPx) || 0, dragY: -(-aim.pendY - ry.restPx) || 0 };
      aim.azTaps = 0; aim.rangeTaps = 0; aim.pendX = rx.restPx; aim.pendY = -ry.restPx || 0;
      s.weapon = ctx.weapon || null;
      s.target = ctx.target || null;
      s.ghost = ctx.ghost || null;
      s.shelterOn = !!ctx.shelterOn;
      s.build = { ...build };
      s.impactHeld = holds.impact || mouseImpact;
      s.showJobs = holds.jobs;
      s.freeLook = { yaw: freeLook.yaw, pitch: freeLook.pitch };
      s.menu = menu; menu = false;
      return s;
    },
    dispose() {
      keyTarget.removeEventListener("keydown", onKeyDown);
      keyTarget.removeEventListener("keyup", onKeyUp);
      keyTarget.removeEventListener("blur", blur);
      el.removeEventListener("mousedown", onMouseDown);
      el.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("contextmenu", onContext);
    },
  };
}

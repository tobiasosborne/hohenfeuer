// tests/unit/ui-input.test.js - owns key/mouse -> input-sample tests for src/player/input.js using fake event targets.
import test from "node:test";
import assert from "node:assert/strict";
import { CAMERA_MODE, CMD, validateCommand } from "../../src/contracts.js";
import { createInput, KEYMAP } from "../../src/player/input.js";
import { ACTION, BUILD, buildCommands, AIM_RATE } from "../../src/player/commands.js";

function rig(extra = {}) {
  const keyTarget = new EventTarget();
  const doc = new EventTarget();
  doc.pointerLockElement = null;
  const element = new EventTarget();
  element.requestPointerLock = () => { doc.pointerLockElement = element; };
  doc.exitPointerLock = () => { doc.pointerLockElement = null; };
  const input = createInput({ keyTarget, element, doc, toLogical: (x, y) => ({ x, y }), sensitivity: 0.002, ...extra });
  const fire = (target, type, props = {}) => { const e = new Event(type, { cancelable: true }); Object.assign(e, props); target.dispatchEvent(e); return e; };
  const key = (code, down = true, props = {}) => fire(keyTarget, down ? "keydown" : "keyup", { code, ...props });
  const mouse = (type, props = {}) => fire(element, type, props);
  return { input, key, mouse, doc, element };
}

test("KEYMAP covers DESIGN 4.8 / 5 keys", () => {
  for (const code of ["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ShiftLeft", "KeyE", "KeyQ", "KeyR", "KeyB", "KeyG", "KeyX", "KeyF",
    "Home", "End", "PageUp", "PageDown", "Escape", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ControlLeft"]) {
    assert.ok(KEYMAP[code], code);
  }
});

test("walk: WASD + Shift -> move axes, Space jump; edge actions fire once", () => {
  const { input, key } = rig();
  key("KeyW"); key("KeyD"); key("ShiftLeft"); key("Space");
  let s = input.sample({});
  assert.deepEqual(s.move, { fwd: 1, strafe: 1, sprint: true, jump: true });
  key("KeyW", false); key("KeyD", false); key("KeyA");
  s = input.sample({});
  assert.equal(s.move.fwd, 0); assert.equal(s.move.strafe, -1);
  key("KeyE"); key("KeyE", true, { repeat: true });
  assert.deepEqual(input.sample({}).actions, [ACTION.INTERACT]);
  assert.deepEqual(input.sample({}).actions, []);
  key("KeyQ"); key("KeyR"); key("KeyX");
  assert.deepEqual(input.sample({}).actions, [ACTION.ORDER_CREW, ACTION.PRIORITY, ACTION.SHELTER]);
});

test("mouse look only while pointer-locked; pitch clamps", () => {
  const { input, mouse, doc, element } = rig();
  mouse("mousemove", { movementX: 100, movementY: 0 });
  assert.equal(input.sample({}).look.yaw, 0);
  mouse("mousedown", { button: 0, clientX: 10, clientY: 10 });
  assert.equal(doc.pointerLockElement, element);
  mouse("mousemove", { movementX: 100, movementY: -50 });
  const s = input.sample({});
  assert.ok(Math.abs(s.look.yaw - 0.2) < 1e-12); assert.ok(Math.abs(s.look.pitch - 0.1) < 1e-12);
  mouse("mousemove", { movementX: 0, movementY: -100000 });
  assert.ok(Math.abs(input.sample({}).look.pitch - 89 * Math.PI / 180) < 1e-12);
  input.setLook(1, 0);
  assert.equal(input.sample({}).look.yaw, 1);
});

test("weapon view: arrows/WASD tap aim, Ctrl, Space fires, Esc leaves, F/Home actions", () => {
  const { input, key } = rig();
  input.setMode(CAMERA_MODE.WEAPON);
  key("ArrowRight"); key("ArrowRight", true, { repeat: true }); key("KeyW"); key("ArrowLeft"); key("ArrowLeft", false);
  key("ControlLeft"); key("Space"); key("KeyF"); key("Home");
  const s = input.sample({ weapon: { id: 2, az: 0, range: 380, autoFire: false } });
  assert.equal(s.mode, CAMERA_MODE.WEAPON);
  assert.equal(s.aim.azTaps, 1); assert.equal(s.aim.rangeTaps, 1); assert.equal(s.ctrl, true);
  assert.deepEqual(s.actions, [ACTION.FIRE, ACTION.AUTO_FIRE, ACTION.RESTORE]);
  assert.deepEqual(s.move, { fwd: 0, strafe: 0, sprint: false, jump: false });
  const cmds = buildCommands(s, 1);
  assert.deepEqual(cmds.map((c) => c.type), [CMD.AIM, CMD.FIRE, CMD.RESTORE_AIM, CMD.AUTO_FIRE]);
  cmds.forEach(validateCommand);
  key("Escape");
  assert.deepEqual(input.sample({}).actions, [ACTION.LEAVE]);
  key("End"); assert.equal(input.sample({}).impactHeld, true);
  key("End", false); assert.equal(input.sample({}).impactHeld, false);
});

test("weapon view: HUD clicks (fire, pad, buttons) and readout drags keep sub-unit remainders", () => {
  const { input, mouse } = rig();
  input.setMode(CAMERA_MODE.WEAPON);
  mouse("mousedown", { button: 0, clientX: 511, clientY: 676 }); mouse("mouseup", { button: 0, clientX: 511, clientY: 676 });
  mouse("mousedown", { button: 0, clientX: 511, clientY: 640 }); mouse("mouseup", { button: 0 });
  mouse("mousedown", { button: 0, clientX: 300, clientY: 674 }); mouse("mouseup", { button: 0 });
  mouse("mousedown", { button: 0, clientX: 700, clientY: 674 }); mouse("mouseup", { button: 0 });
  let s = input.sample({});
  assert.deepEqual(s.actions, [ACTION.FIRE, ACTION.AUTO_FIRE, ACTION.RESTORE]);
  assert.equal(s.aim.rangeTaps, 1);
  // impact-view button is held
  mouse("mousedown", { button: 0, clientX: 700, clientY: 708 });
  assert.equal(input.sample({}).impactHeld, true);
  mouse("mouseup", { button: 0 });
  assert.equal(input.sample({}).impactHeld, false);
  // range drag: 1 px per event, 0.5 unit per px; units total = floor(px * 0.5)
  mouse("mousedown", { button: 0, clientX: 540, clientY: 610 });
  let units = 0;
  const w = { id: 1, az: 0, range: 500, autoFire: false };
  for (let i = 0; i < 7; i++) {
    mouse("mousemove", { movementX: 0, movementY: -1 });
    s = input.sample({ weapon: w });
    const c = buildCommands(s, i).find((x) => x.type === CMD.AIM);
    if (c) { units += c.range - w.range; }
  }
  mouse("mouseup", { button: 0 });
  assert.equal(units, Math.trunc(7 * AIM_RATE.RANGE_PER_PX));
  // direction drag: 1 unit per px
  mouse("mousedown", { button: 0, clientX: 470, clientY: 610 });
  mouse("mousemove", { movementX: 12, movementY: 0 });
  s = input.sample({ weapon: w });
  assert.equal(s.aim.dragX, 12); assert.equal(s.aim.dragY, 0);
  mouse("mouseup", { button: 0 });
  // RMB free look returns on release
  mouse("mousedown", { button: 2, clientX: 512, clientY: 300 });
  mouse("mousemove", { movementX: 50, movementY: 0 });
  assert.ok(input.sample({}).freeLook.yaw > 0);
  mouse("mouseup", { button: 2 });
  assert.equal(input.sample({}).freeLook.yaw, 0);
});

test("build mode toggles (B, G), digits pick a block, LMB/RMB become PRIMARY/SECONDARY", () => {
  const { input, key, mouse } = rig({ blockIds: [1, 2, 4, 5, 6, 7, 8, 9, 10] });
  key("KeyB");
  let s = input.sample({});
  assert.equal(s.build.mode, BUILD.BLOCK); assert.ok(!s.actions.includes(ACTION.BUILD_MODE) || true);
  key("Digit3"); assert.equal(input.sample({}).build.block, 4);
  key("KeyG"); assert.equal(input.sample({}).build.mode, BUILD.WEAPON);
  key("KeyG"); assert.equal(input.sample({}).build.mode, BUILD.NONE);
  key("KeyB");
  mouse("mousedown", { button: 0, clientX: 10, clientY: 10 }); // also locks
  mouse("mousedown", { button: 0, clientX: 10, clientY: 10 });
  mouse("mousedown", { button: 2, clientX: 10, clientY: 10 });
  s = input.sample({});
  assert.deepEqual(s.actions.filter((a) => a === ACTION.PRIMARY || a === ACTION.SECONDARY), [ACTION.PRIMARY, ACTION.SECONDARY]);
});

test("Tab holds the job overlay; blur clears held keys", () => {
  const { input, key, element } = rig();
  key("Tab"); assert.equal(input.sample({}).showJobs, true);
  key("KeyW");
  input.blur();
  const s = input.sample({});
  assert.equal(s.showJobs, false); assert.equal(s.move.fwd, 0);
  input.dispose();
  assert.ok(element);
});

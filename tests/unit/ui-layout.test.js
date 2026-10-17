// tests/unit/ui-layout.test.js - owns the HUD rect checks for src/ui/layout.js (DESIGN 7.5).
import test from "node:test";
import assert from "node:assert/strict";
import { TUNING } from "../../src/tuning.js";
import { LAYOUT, TOP_LEVEL, CONSOLE_WEAPON, CONSOLE_WALK, letterbox, toLogical, hitTest, circleBox, rectOf } from "../../src/ui/layout.js";

const W = TUNING.render.logicalW, H = TUNING.render.logicalH;
const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const inside = (a, b) => a.x0 >= b.x0 && a.y0 >= b.y0 && a.x1 <= b.x1 && a.y1 <= b.y1;
const SCREEN = { x0: 0, y0: 0, x1: W, y1: H };

function pairwise(ids, label) {
  const rs = ids.map((id) => [id, rectOf(id)]);
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    assert.ok(!overlap(rs[i][1], rs[j][1]), `${label}: ${rs[i][0]} overlaps ${rs[j][0]}`);
  }
}

test("every rect is integer, non-empty and inside 1024 x 768", () => {
  for (const [id, r] of Object.entries(LAYOUT)) {
    const b = r.r !== undefined ? circleBox(r) : r;
    for (const k of ["x0", "y0", "x1", "y1"]) assert.ok(Number.isInteger(b[k]), `${id}.${k}`);
    assert.ok(b.x1 > b.x0 && b.y1 > b.y0, `${id} empty`);
    assert.ok(inside(b, SCREEN), `${id} outside screen`);
  }
});

test("DESIGN 7.5 anchor values (+-4 px)", () => {
  const near = (a, b) => Math.abs(a - b) <= 4;
  const c = LAYOUT.compass;
  assert.ok(near(c.cx, 908) && near(c.cy, 110) && near(c.r, 68));
  assert.ok(near(LAYOUT.readouts.x0, 448) && near(LAYOUT.readouts.y0, 598) && near(LAYOUT.readouts.x1, 572) && near(LAYOUT.readouts.y1, 622));
  assert.ok(near(LAYOUT.console.x0, 213) && near(LAYOUT.console.y0, 565) && near(LAYOUT.console.x1, 812));
  assert.ok(near(LAYOUT.fire.cx, 511) && near(LAYOUT.fire.cy, 676) && near(LAYOUT.pad.r, 48));
  assert.ok(near(LAYOUT.reloadBar.x0, 240) && near(LAYOUT.weaponBar.x1, 782));
  assert.ok(near(LAYOUT.leftMapInner.x0, 22) && near(LAYOUT.rightMapInner.x1, 1002));
});

test("top-level HUD elements do not overlap each other", () => pairwise(TOP_LEVEL, "top"));

test("console children lie inside the console and do not overlap", () => {
  for (const set of [CONSOLE_WEAPON, CONSOLE_WALK]) {
    for (const id of set) assert.ok(inside(rectOf(id), LAYOUT.console), `${id} outside console`);
    pairwise(set, "console");
  }
  assert.ok(inside(rectOf("fire"), rectOf("pad")));
  assert.ok(inside(LAYOUT.leftMapInner, LAYOUT.leftMap));
  assert.ok(inside(LAYOUT.rightMapInner, LAYOUT.rightMap));
  assert.ok(inside(LAYOUT.readoutDir, LAYOUT.readouts) && inside(LAYOUT.readoutRange, LAYOUT.readouts));
});

test("letterbox scale and inverse mapping", () => {
  assert.deepEqual(letterbox(1024, 768), { scale: 1, x: 0, y: 0, w: 1024, h: 768 });
  const lb = letterbox(1920, 1080);
  assert.equal(lb.scale, 1080 / 768);
  assert.equal(lb.x, (1920 - 1024 * lb.scale) / 2);
  assert.equal(lb.y, 0);
  const tall = letterbox(800, 1000);
  assert.equal(tall.scale, 800 / 1024); assert.equal(tall.x, 0); assert.ok(tall.y > 0);
  const p = toLogical(lb, lb.x + 511 * lb.scale, lb.y + 676 * lb.scale);
  assert.ok(Math.abs(p.x - 511) < 1e-9 && Math.abs(p.y - 676) < 1e-9);
});

test("hitTest finds weapon-view controls", () => {
  assert.equal(hitTest(511, 676, "weapon"), "fire");
  assert.equal(hitTest(511, 676 - 36, "weapon"), "pad-up");
  assert.equal(hitTest(511, 676 + 36, "weapon"), "pad-down");
  assert.equal(hitTest(511 - 36, 676, "weapon"), "pad-left");
  assert.equal(hitTest(511 + 36, 676, "weapon"), "pad-right");
  assert.equal(hitTest(470, 610, "weapon"), "readoutDir");
  assert.equal(hitTest(540, 610, "weapon"), "readoutRange");
  assert.equal(hitTest(300, 674, "weapon"), "btnL1");
  assert.equal(hitTest(700, 708, "weapon"), "btnR2");
  assert.equal(hitTest(512, 300, "weapon"), null);
  assert.equal(hitTest(511, 676, "walk"), null);
});

// tests/unit/ui-tb3.test.js - owns ghost/support parity and the build-mode HUD cost ledger.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BLOCK, CAMERA_MODE } from '../../src/contracts.js';
import { ghost, GHOST_REASON } from '../../src/player/interact.js';
import { fixture } from './npc-fixture.test.js';
import { createHud, designationMessages } from '../../src/ui/hud.js';
import { EV } from '../../src/contracts.js';

test('TB3: ghost rejects an unsupported adjacent designation and a live cannon cell', () => {
  const { plot } = fixture();
  const q = { target: { kind: 'designation', own: true, cell: [5, 3, 3], normal: [0, 1, 0] },
    plot, slot: 0, gold: 5000, openDesignations: 0, build: { mode: 'block', block: BLOCK.STONE, cost: 1 } };
  assert.equal(ghost(q).valid, false);
  assert.equal(ghost(q).reason, GHOST_REASON.SUPPORT);
  q.target = { kind: 'block', own: true, cell: [5, 0, 3], normal: [0, 1, 0] };
  q.weapons = [{ hp: 36, pos: { x: 5.5, y: 1, z: 3.5 } }];
  assert.equal(ghost(q).valid, false);
});

test('TB3: HUD exposes selected price, available gold and reserved amount, with local designation messages', () => {
  const ctx = new Proxy({ canvas: { width: 1024, height: 768 } }, { get(t, k) {
    if (k in t) return t[k];
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
    return () => {};
  } });
  const hud = createHud(ctx, { createCanvas: null });
  hud.draw({ mode: CAMERA_MODE.WALK, lang: 'en', gold: 1495, reserved: 5, selection: { name: 'Stone', cost: 1, valid: true } });
  assert.ok(hud.frame.texts.some(s => s.includes('Stone') && s.includes('1')));
  assert.ok(hud.frame.texts.some(s => s.includes('1495') && s.includes('5') && s.includes('Reserved')));
  const messages = designationMessages([
    { type: EV.DESIGNATION_ADDED, payload: { slot: 0, reserved: 1 } },
    { type: EV.DESIGNATION_CANCELLED, payload: { slot: 0 } },
    { type: EV.BLOCK_BUILT, payload: { plot: 0 } },
    { type: EV.DESIGNATION_ADDED, payload: { slot: 1 } },
  ], { slot: 0, lang: 'en' });
  assert.equal(messages.length, 3);
});

test('TB3: preview color and designation wire batch follow placement/build/cancel lifecycle', async () => {
  const THREE = await import('three');
  const { createGhostView } = await import('../../src/render/ghost-view.js');
  const scene = new THREE.Scene(), view = createGhostView({ scene }), { castle, plot } = fixture();
  const state = { castles: [castle] };
  castle.npcDesignations = [{ cell:[5,1,3],kind:'build',block:BLOCK.STONE }];
  const context = { plot,build:{mode:'block'},ghost:{cell:[5,1,3],facing:0,valid:true} };
  assert.equal(view.update(state,context),1);
  assert.ok(view.preview.visible);
  assert.equal(view.preview.children[0].material.color.getHex(),0x45ee78);
  assert.equal(view.outlines.geometry.getAttribute('position').count,24);
  context.ghost.valid=false; view.update(state,context);
  assert.equal(view.preview.children[0].material.color.getHex(),0xff493e);
  castle.npcDesignations=[]; view.update(state);
  assert.equal(view.count,0); assert.equal(view.preview.visible,false);
  view.dispose(); assert.equal(scene.children.length,0);
});

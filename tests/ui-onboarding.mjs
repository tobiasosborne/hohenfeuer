// owns: deterministic browser acceptance for quick start, feature gates, prompts and profile overrides.
// Run on a socket-enabled SwiftShader runner: node tests/ui-onboarding.mjs.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { startServer, launch } from './lib.mjs';

const out = resolve('tests/evidence/onboarding');
await mkdir(out, { recursive: true });
const report = { status: 'running', checks: [], errors: [] };
let server, browser;
const H = 'window.__hohenfeuer';
const ready = (p, condition = '!window.__hohenfeuer.frontend') => p.waitForFunction(`${H}?.ready && (${condition})`, null, { timeout: 90000 });
const press = async (page, key) => {
  await page.keyboard.press(key);
  // A second tick synchronises input mode after entering/leaving a weapon.
  await page.evaluate(`${H}.playerStep(); ${H}.playerStep()`);
};
try {
  let url; ({ server, url } = await startServer()); browser = await launch();
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  await page.goto(new URL('index.html?golden=1&screen=main', url).href);
  await ready(page, `${H}.frontend`);
  assert.equal(await page.evaluate(`${H}.menu.focusId`), 'quickStart');
  assert.ok((await page.evaluate(`${H}.texts`)).includes('Schnellstart'));
  await page.screenshot({ path: resolve(out, 'after-title.png') });
  await page.evaluate(`${H}.key('Enter')`);
  await ready(page);
  assert.equal(await page.evaluate(`${H}.state.slots[1].aiLevel`), 2);
  assert.equal(await page.evaluate(`${H}.features.match`), 1);
  assert.equal(await page.evaluate(`${H}.features.placement`), false);
  report.checks.push('one-action-quick-start-ai2-match1');

  await press(page, 'KeyG'); await press(page, 'KeyR'); await press(page, 'KeyX'); await press(page, 'Tab');
  assert.equal(await page.evaluate(`${H}.input.build.mode`), 'none');
  assert.ok(!(await page.evaluate(`${H}.hud.frame.texts`)).includes('R: Priorität'));
  await press(page, 'KeyB'); await press(page, 'Digit3');
  assert.equal(await page.evaluate(`${H}.input.build.block`), 1);
  await press(page, 'KeyB');
  report.checks.push('locked-keys-and-stone-only');

  // Walk the existing route; stop before the script mans or fires the gun.
  await page.evaluate(() => {
    const h = window.__hohenfeuer; h.runScript('tb1');
    for (let n = 0; n < 1000 && h.script().phase === 'walk'; n++) h.stepTo(h.state.tick + 1);
    assertRoute(h.script().phase);
    function assertRoute(phase) { if (phase !== 'man') throw Error(`route ended in ${phase}`); }
    const r = h.state.rulers[0], w = h.state.weapons.filter(w => w.slot === 0)[1];
    const dx = w.pos.x - r.pos.x, dz = w.pos.z - r.pos.z, dy = w.pos.y + 0.5 - (r.pos.y + 1.6);
    h.setBuild({ mode: 'none' }, { yaw: Math.atan2(dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx,dz)) });
  });
  assert.equal(await page.evaluate(`${H}.onboarding.prompt?.id`), 'man');
  await press(page, 'KeyE');
  assert.ok(await page.evaluate(`${H}.state.weapons.find(w => w.id === ${H}.state.rulers[0].manning).crewOrdered`));
  assert.equal(await page.evaluate(`${H}.onboarding.prompt?.id`), 'fire');
  await press(page, 'Space');
  assert.equal(await page.evaluate(`${H}.profile.promptUses.fire`), 1);
  await press(page, 'KeyE'); await press(page, 'KeyE');
  assert.equal(await page.evaluate(`${H}.profile.promptUses.man`), 2);
  await press(page, 'KeyE');
  assert.notEqual(await page.evaluate(`${H}.onboarding.prompt?.id`), 'man');
  report.checks.push('real-reticle-E-auto-crew-fire-and-man-retirement');

  await page.evaluate(`${H}.enemyShot(); ${H}.stepTo(${H}.state.tick + 30)`);
  assert.equal(await page.evaluate(`${H}.onboarding.wallHit`), true);
  assert.equal(await page.evaluate(`${H}.onboarding.prompt?.id`), 'build');
  await page.screenshot({ path: resolve(out, 'after-first-damage.png') });
  await press(page, 'KeyB'); await press(page, 'KeyB'); await press(page, 'KeyB'); await press(page, 'KeyB');
  assert.equal(await page.evaluate(`${H}.profile.promptUses.build`), 2);
  assert.notEqual(await page.evaluate(`${H}.onboarding.prompt?.id`), 'build');
  report.checks.push('own-wall-hit-B-prompt-and-retirement');

  const overrides = await page.evaluate(() => {
    const h = window.__hohenfeuer, hash = h.sim.hash();
    h.setProfile(3); const third = h.features;
    h.setProfile(10); const tenth = h.features;
    h.setProfile(0); const first = h.features;
    return { sameSim: hash === h.sim.hash(), third, tenth, first, saved: localStorage.getItem('hohenfeuer.profile.v1') };
  });
  assert.ok(overrides.sameSim);
  assert.ok(overrides.third.keys.includes('KeyG') && !overrides.third.keys.includes('KeyX'));
  assert.equal(overrides.tenth.weapons.length, 10);
  assert.equal(overrides.first.match, 1);
  assert.equal(overrides.saved, null, 'goldens and debug overrides never write career storage');
  report.checks.push('debug-profile-isolation-and-tiers');
  for (const [param, match, count] of [[0,1,1], [3,3,2], [10,10,10]]) {
    await page.goto(new URL(`index.html?golden=1&profile=${param}`, url).href); await ready(page);
    assert.equal(await page.evaluate(`${H}.features.match`), match);
    assert.equal(await page.evaluate(`${H}.features.weapons.length`), count);
  }
  report.checks.push('URL-profile-0-3-10');
  assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (e) {
  report.status = 'failed'; report.failure = String(e.stack ?? e); process.exitCode = 1;
} finally {
  await writeFile(resolve(out, 'browser-acceptance.json'), JSON.stringify(report, null, 2));
  await browser?.close(); await server?.close();
  console.log(JSON.stringify(report, null, 2));
}

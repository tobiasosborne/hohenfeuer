// tests/unit/plugin-weapon-conformance.test.js - owns reference cannon data and view conformance.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { MOUNT, TRAJ, PLUGIN_KIND, getWeapon, getView, resetRegistriesForTests, validateWeaponPlugin, validateWeaponView } from '../../src/contracts.js';
import { TUNING } from '../../src/tuning.js';
import { CANNON, CANNON_MIN_CREW, registerCannon } from '../../src/plugins/weapons/cannon/cannon.sim.js';
import { CANNON_VIEW, CANNON_PARTS, CANNON_MUZZLE_OFFSET, CANNON_MATERIALS, registerCannonView } from '../../src/plugins/weapons/cannon/cannon.view.js';

afterEach(resetRegistriesForTests);

test('cannon validates and preserves every cannon tuning input', () => {
  const row = TUNING.weapons.cannon;
  assert.equal(validateWeaponPlugin(CANNON), true);
  for (const field of ['cost', 'hp', 'reloadS', 'crewSlots', 'fireCost', 'v0', 'k']) assert.equal(CANNON[field], row[field], field);
  assert.equal(CANNON.mount, MOUNT.WALL);
  assert.equal(CANNON.traj, TRAJ.STRAIGHT);
  assert.deepEqual(CANNON.footprint, TUNING.weaponRules.wallFootprint);
  assert.deepEqual(CANNON.elevDeg, TUNING.aim.straightElevDeg);
  assert.deepEqual(CANNON.scatter, { azDeg: row.sAzDeg, vFrac: row.sV });
  assert.equal(CANNON_MIN_CREW, Math.ceil(CANNON.crewSlots * TUNING.weaponRules.minCrewFrac));
  assert.equal(CANNON.ammoLoads, 1);
  assert.deepEqual(CANNON.shot, {
    count: row.count, intervalS: row.intervalS, spreadDeg: row.spreadDeg, radius: row.projRadius,
    direct: row.direct, splash: row.splash, splashRadius: row.splashRadius, ignite: row.ignite, pierce: row.pierce,
  });
});

test('cannon view describes the kit node hierarchy, muzzle and Lambert materials', () => {
  assert.equal(validateWeaponView(CANNON.id, CANNON_VIEW), true);
  assert.equal(CANNON_VIEW.model, 'assets/kit-v1/cannon.glb');
  assert.deepEqual(CANNON_PARTS, { frame: 'Base', turntable: 'Yaw', barrel: 'Pitch', muzzle: 'Muzzle', sight: 'Sight' });
  assert.deepEqual(CANNON_VIEW.nodes, { yaw: CANNON_PARTS.turntable, pitch: CANNON_PARTS.barrel, muzzle: CANNON_PARTS.muzzle, sight: CANNON_PARTS.sight });
  assert.deepEqual(CANNON_MUZZLE_OFFSET, [0, TUNING.weaponRules.wallFootprint[2] * 0.75, -(TUNING.weaponRules.wallFootprint[0] / 2 + 2 * CANNON.shot.radius)]);
  for (const part of ['frame', 'turntable', 'barrel']) {
    assert.equal(CANNON_MATERIALS[part].type, 'MeshLambertMaterial');
    assert.match(CANNON_MATERIALS[part].color, /^#[0-9a-f]{6}$/);
  }
});

test('cannon and its view register through contracts and reject a second registration', () => {
  registerCannon();
  registerCannonView();
  assert.deepEqual(getWeapon(CANNON.id), CANNON);
  assert.deepEqual(getView(PLUGIN_KIND.WEAPON, CANNON.id), CANNON_VIEW);
  assert.throws(registerCannon, /duplicate weapon/);
  assert.throws(registerCannonView, /duplicate weapon view/);
});

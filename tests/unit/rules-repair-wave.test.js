// tests/unit/rules-repair-wave.test.js - owns the explicit late keep-cracking rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import { palaceDefeatThreshold } from '../../src/sim/rules.js';
test('keep cracking ramps continuously from minute ten through fifteen', () => {
  assert.equal(palaceDefeatThreshold(0), .3);
  assert.equal(palaceDefeatThreshold(10 * 60 * 30), .3);
  assert.ok(Math.abs(palaceDefeatThreshold(12.5 * 60 * 30) - .425) < 1e-10);
  assert.equal(palaceDefeatThreshold(15 * 60 * 30), .55);
  assert.equal(palaceDefeatThreshold(20 * 60 * 30), .55);
});

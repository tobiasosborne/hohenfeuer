// tests/unit/ui-options.test.js - owns persistence and sanitising tests for src/ui/options.js (localStorage-backed player options).
import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_OPTIONS, OPTION_VALUES, loadOptions, saveOptions, sanitizeOptions, OPTIONS_KEY } from "../../src/ui/options.js";

function memStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), map: m };
}
const throwing = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } };

test("defaults when nothing is stored, storage is missing, broken or throws", () => {
  assert.deepEqual(loadOptions(memStorage()), DEFAULT_OPTIONS);
  assert.deepEqual(loadOptions(null), DEFAULT_OPTIONS);
  assert.deepEqual(loadOptions(memStorage({ [OPTIONS_KEY]: "{not json" })), DEFAULT_OPTIONS);
  assert.deepEqual(loadOptions(throwing), DEFAULT_OPTIONS);
  assert.equal(saveOptions(throwing, DEFAULT_OPTIONS), false);
});

test("save then load round-trips every allowed value", () => {
  const s = memStorage();
  for (const lang of OPTION_VALUES.lang) for (const volume of OPTION_VALUES.volume) {
    const o = { ...DEFAULT_OPTIONS, lang, volume, sensitivity: OPTION_VALUES.sensitivity[OPTION_VALUES.sensitivity.length - 1] };
    assert.equal(saveOptions(s, o), true);
    assert.deepEqual(loadOptions(s), o);
  }
});

test("sanitize snaps to the nearest allowed value and drops unknown keys", () => {
  const o = sanitizeOptions({ lang: "fr", volume: 37, sensitivity: 0.0021, extra: 1 });
  assert.equal(o.lang, DEFAULT_OPTIONS.lang);
  assert.equal(o.volume, OPTION_VALUES.volume[OPTION_VALUES.volume.length - 1]);
  assert.ok(OPTION_VALUES.sensitivity.includes(o.sensitivity));
  assert.deepEqual(Object.keys(o).sort(), Object.keys(DEFAULT_OPTIONS).sort());
  assert.ok(OPTION_VALUES.sensitivity.includes(DEFAULT_OPTIONS.sensitivity));
  assert.equal(DEFAULT_OPTIONS.followCam, true);
  assert.equal(sanitizeOptions({ followCam: false }).followCam, false);
  assert.equal(sanitizeOptions({ followCam: "yes" }).followCam, true);
});

// owns: smoke test for the src/contracts.js export surface (v1, replaces the v0 placeholder checks).
import test from "node:test";
import assert from "node:assert/strict";
import * as contracts from "../../src/contracts.js";

test("contracts exports VERSION 1", () => {
  assert.equal(contracts.VERSION, 1);
});

test("contracts exports a non-empty frozen EVENTS object (alias of EV)", () => {
  assert.ok(Object.keys(contracts.EVENTS).length > 0);
  assert.ok(Object.isFrozen(contracts.EVENTS));
  assert.equal(contracts.EVENTS, contracts.EV);
});

test("registerPlugin is a function that rejects unknown kinds", () => {
  assert.equal(typeof contracts.registerPlugin, "function");
  assert.throws(() => contracts.registerPlugin(), /unknown plugin kind/);
});

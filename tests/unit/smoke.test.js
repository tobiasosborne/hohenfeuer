// owns: smoke test for the src/contracts.js export surface.
import test from "node:test";
import assert from "node:assert/strict";
import * as contracts from "../../src/contracts.js";

test("contracts exports VERSION 0", () => {
  assert.equal(contracts.VERSION, 0);
});

test("contracts exports an empty EVENTS object", () => {
  assert.deepEqual(contracts.EVENTS, {});
});

test("registerPlugin is a function stub that throws", () => {
  assert.equal(typeof contracts.registerPlugin, "function");
  assert.throws(() => contracts.registerPlugin(), /not implemented/);
});

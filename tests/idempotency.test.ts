import test = require("node:test");
import assert = require("node:assert/strict");
import { IdempotencyStore } from "../packages/core/src/idempotency";
import { DeduplicationWindow } from "../packages/core/src/deduplication";

test("idempotency expires values", () => {
  let now = 100;
  const store = new IdempotencyStore<string>(50, () => now);
  store.set("key", "value");
  assert.equal(store.get("key"), "value");
  now = 151;
  assert.equal(store.get("key"), undefined);
});

test("deduplication suppresses repeated IDs", () => {
  const dedupe = new DeduplicationWindow(1000, () => 1);
  assert.equal(dedupe.accept("event-1"), true);
  assert.equal(dedupe.accept("event-1"), false);
});

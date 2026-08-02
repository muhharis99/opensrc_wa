import test = require("node:test");
import assert = require("node:assert/strict");
import { CapabilityRegistry } from "../packages/capabilities/src/registry";

test("capability registry exposes broad mock parity without live claims", () => {
  const registry = new CapabilityRegistry();
  const features = registry.list();
  assert.ok(features.length >= 35);
  assert.ok(features.some((feature) => feature.id === "message.reaction" && feature.status === "TESTED_WITH_MOCK"));
  assert.ok(features.some((feature) => feature.id === "group.management" && feature.status === "TESTED_WITH_MOCK"));
  assert.ok(features.some((feature) => feature.id === "protocol.live-handshake" && feature.status === "BLOCKED"));
  assert.equal(registry.summary().LIVE_TESTED, 0);
  assert.equal(registry.list({ domain: "protocol" }).every((feature) => feature.status === "BLOCKED"), true);
});

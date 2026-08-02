import test = require("node:test");
import assert = require("node:assert/strict");
import { PluginRegistry } from "../packages/plugins/src/plugin-registry";
import { OpenSrcWaClient } from "../packages/sdk/src/client";

test("plugin registry runs only matching safe hooks", async () => {
  const registry = new PluginRegistry();
  registry.register({ id: "audit.plugin", version: "1.0.0", hooks: ["message.after_send"], handle: (context) => context.hook });
  assert.deepEqual(await registry.run("message.after_send", "s1", {}), ["message.after_send"]);
  assert.deepEqual(await registry.run("session.ready", "s1", {}), []);
});

test("SDK sends authenticated requests", async () => {
  let captured = "";
  const fakeFetch = (async (url: string | URL, init?: RequestInit) => {
    captured = `${String(url)}:${String((init?.headers as Record<string, string>)["X-API-Key"])}`;
    return new Response(JSON.stringify({ success: true, data: { ok: true }, error: null, meta: { request_id: "r", timestamp: new Date().toISOString() } }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  const client = new OpenSrcWaClient({ baseUrl: "http://localhost:3000", apiKey: "secret", fetchImpl: fakeFetch });
  assert.deepEqual(await client.capabilities(), { ok: true });
  assert.equal(captured, "http://localhost:3000/api/v1/capabilities:secret");
});

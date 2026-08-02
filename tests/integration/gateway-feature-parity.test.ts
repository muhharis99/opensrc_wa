import test = require("node:test");
import assert = require("node:assert/strict");
import fs = require("node:fs/promises");
import os = require("node:os");
import path = require("node:path");
import { createGateway } from "../../apps/gateway/src/server";
import { CryptoProvider } from "../../packages/crypto/src/crypto-provider";
import type { GatewayConfig } from "../../apps/gateway/src/config";

class SilentLogger { public debug(): void {} public info(): void {} public warn(): void {} public error(): void {} }

test("gateway exposes feature-parity mock APIs", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "opensrc-wa-parity-"));
  const apiKey = "feature-parity-secret";
  const config: GatewayConfig = {
    host: "127.0.0.1", port: 0, apiKeyHash: new CryptoProvider().sha256(apiKey), sessionKey: new Uint8Array(32).fill(5),
    store: "encrypted-file", dataDir: directory, protocolMode: "mock", corsOrigins: [], rateLimitPerMinute: 500,
    maxBodyBytes: 1_048_576, webhookTimeoutMs: 100, webhookMaxRetries: 1
  };
  const runtime = createGateway(config, { logger: new SilentLogger() });
  await new Promise<void>((resolve) => runtime.server.listen(0, "127.0.0.1", resolve));
  const address = runtime.server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  const headers = { "X-API-Key": apiKey, "Content-Type": "application/json" };
  const call = async (method: string, route: string, body?: unknown): Promise<{ status: number; data: any }> => {
    const response = await fetch(`${base}${route}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
    const payload = response.status === 204 ? { data: null } : await response.json() as { data: any };
    return { status: response.status, data: payload.data };
  };

  const capability = await call("GET", "/api/v1/capabilities");
  assert.equal(capability.status, 200);
  assert.ok(capability.data.features.length >= 35);

  await call("POST", "/api/v1/sessions", { session_id: "parity" });
  const code = await call("POST", "/api/v1/sessions/parity/pairing-code", { phone: "6281234567890" });
  assert.equal(code.data.method, "pairing-code");
  await call("POST", "/api/v1/sessions/parity/mock-complete-pairing");

  const contact = await call("POST", "/api/v1/contacts", { session_id: "parity", phone: "6281234567890", name: "Opted In" });
  assert.equal(contact.status, 201);
  await call("POST", "/api/v1/contacts/6281234567890/consent", { session_id: "parity", basis: "integration test" });

  const media = await call("POST", "/api/v1/media", {
    session_id: "parity", kind: "image", file_name: "fixture.png", mime_type: "image/png",
    content_base64: Buffer.from("fixture-image").toString("base64"), caption: "image"
  });
  assert.equal(media.status, 201);

  const sent = await call("POST", "/api/v1/messages/media", {
    session_id: "parity", to: "6281234567890", media_id: media.data.mediaId, media_type: "image",
    caption: "hello", idempotency_key: "gateway-parity-0001"
  });
  assert.equal(sent.status, 202);
  assert.equal(sent.data.type, "image");

  const group = await call("POST", "/api/v1/groups", { session_id: "parity", subject: "Team", participants: ["6281234567890@s.whatsapp.net"] });
  assert.equal(group.status, 201);
  const status = await call("POST", "/api/v1/statuses", { session_id: "parity", owner_jid: "self", type: "text", text: "status" });
  assert.equal(status.status, 201);
  const channel = await call("POST", "/api/v1/channels", { session_id: "parity", name: "News", owner_jid: "self" });
  assert.equal(channel.status, 201);
  const community = await call("POST", "/api/v1/communities", { session_id: "parity", subject: "Community", owner_jid: "self" });
  assert.equal(community.status, 201);
  const linked = await call("POST", `/api/v1/communities/${encodeURIComponent(community.data.communityId)}/subgroups`, { session_id: "parity", group_id: group.data.groupId, attach: true });
  assert.deepEqual(linked.data.subgroupIds, [group.data.groupId]);

  await runtime.close();
  await fs.rm(directory, { recursive: true, force: true });
});

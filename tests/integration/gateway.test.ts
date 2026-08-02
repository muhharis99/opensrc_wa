import test = require("node:test");
import assert = require("node:assert/strict");
import fs = require("node:fs/promises");
import os = require("node:os");
import path = require("node:path");
import { createGateway } from "../../apps/gateway/src/server";
import { CryptoProvider } from "../../packages/crypto/src/crypto-provider";
import type { GatewayConfig } from "../../apps/gateway/src/config";

class SilentLogger {
  public debug(): void {}
  public info(): void {}
  public warn(): void {}
  public error(): void {}
}

test("gateway enforces auth and supports mock lifecycle", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "opensrc-wa-gateway-"));
  const apiKey = "integration-secret";
  const config: GatewayConfig = {
    host: "127.0.0.1",
    port: 0,
    apiKeyHash: new CryptoProvider().sha256(apiKey),
    sessionKey: new Uint8Array(32).fill(3),
    store: "encrypted-file",
    dataDir: directory,
    protocolMode: "mock",
    corsOrigins: [],
    rateLimitPerMinute: 100,
    maxBodyBytes: 262144,
    webhookTimeoutMs: 100,
    webhookMaxRetries: 1
  };
  const runtime = createGateway(config, { logger: new SilentLogger() });
  await new Promise<void>((resolve) => runtime.server.listen(0, "127.0.0.1", resolve));
  const address = runtime.server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;

  const unauthorized = await fetch(`${base}/api/v1/sessions`);
  assert.equal(unauthorized.status, 401);

  const headers = { "X-API-Key": apiKey, "Content-Type": "application/json" };
  const created = await fetch(`${base}/api/v1/sessions`, { method: "POST", headers, body: JSON.stringify({ session_id: "utama" }) });
  assert.equal(created.status, 201);

  const connected = await fetch(`${base}/api/v1/sessions/utama/connect`, { method: "POST", headers });
  assert.equal(connected.status, 200);

  const qr = await fetch(`${base}/api/v1/sessions/utama/qr`, { headers });
  const qrBody = await qr.json() as { data: { mode: string } };
  assert.equal(qrBody.data.mode, "mock");

  const paired = await fetch(`${base}/api/v1/sessions/utama/mock-complete-pairing`, { method: "POST", headers });
  assert.equal(paired.status, 200);

  const sent = await fetch(`${base}/api/v1/messages/text`, {
    method: "POST",
    headers,
    body: JSON.stringify({ session_id: "utama", to: "6281234567890", text: "fixture", idempotency_key: "integration-0001" })
  });
  assert.equal(sent.status, 202);
  const sentBody = await sent.json() as { data: { message_id: string } };
  assert.ok(sentBody.data.message_id);

  await runtime.close();
  await fs.rm(directory, { recursive: true, force: true });
});

import test = require("node:test");
import assert = require("node:assert/strict");
import fs = require("node:fs/promises");
import os = require("node:os");
import path = require("node:path");
import { SqliteSessionStore } from "../packages/session-store/src/sqlite-store";

test("sqlite store persists session and keys", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "opensrc-wa-sqlite-"));
  const store = new SqliteSessionStore(path.join(directory, "sessions.sqlite"));
  const session = { version: 1 as const, sessionId: "sqlite", state: "READY" as const, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), credentialVersion: 1, metadata: {} };
  await store.saveSession(session);
  await store.setKey("sqlite", "key", new Uint8Array([5]));
  assert.deepEqual(await store.loadSession("sqlite"), session);
  assert.deepEqual(await store.getKey("sqlite", "key"), new Uint8Array([5]));
  await store.deleteSession("sqlite");
  assert.equal(await store.loadSession("sqlite"), null);
  await fs.rm(directory, { recursive: true, force: true });
});

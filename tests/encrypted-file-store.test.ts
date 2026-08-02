import test = require("node:test");
import assert = require("node:assert/strict");
import fs = require("node:fs/promises");
import os = require("node:os");
import path = require("node:path");
import { EncryptedFileSessionStore } from "../packages/session-store/src/encrypted-file-store";

test("encrypted file store persists sessions and keys atomically", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "opensrc-wa-store-"));
  const store = new EncryptedFileSessionStore(directory, new Uint8Array(32).fill(9));
  const session = { version: 1 as const, sessionId: "utama", state: "DISCONNECTED" as const, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), credentialVersion: 0, metadata: {} };
  await store.saveSession(session);
  await store.setKey("utama", "identity", new Uint8Array([1, 2, 3]));
  assert.deepEqual(await store.loadSession("utama"), session);
  assert.deepEqual(await store.getKey("utama", "identity"), new Uint8Array([1, 2, 3]));
  const raw = await fs.readFile(path.join(directory, "sessions.enc.json"), "utf8");
  assert.equal(raw.includes("utama"), false);
  await fs.rm(directory, { recursive: true, force: true });
});

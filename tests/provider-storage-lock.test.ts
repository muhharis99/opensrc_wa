import test = require("node:test");
import assert = require("node:assert/strict");
import fsp = require("node:fs/promises");
import os = require("node:os");
import path = require("node:path");
import { useSqliteAuthState } from "../packages/provider-baileys/src/sqlite-auth-state";
import { SqliteSessionLeaseLock } from "../packages/provider-baileys/src/sqlite-lease-lock";

test("SQLite auth state persists credentials and signal keys", async () => {
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), "opensrc-wa-auth-"));
  const databasePath = path.join(directory, "auth.sqlite");
  const module = {
    initAuthCreds: () => ({ registered: false, marker: "initial" }),
    BufferJSON: { replacer: (_key: string, value: unknown) => value, reviver: (_key: string, value: unknown) => value },
    useMultiFileAuthState: async () => ({ state: {}, saveCreds: async () => undefined })
  };
  const first = await useSqliteAuthState(module, databasePath, "utama");
  first.state.creds.marker = "saved";
  await first.saveCreds();
  await first.state.keys.set({ session: { "device-1": { key: "secret" } } });
  first.close();

  const second = await useSqliteAuthState(module, databasePath, "utama");
  assert.equal(second.state.creds.marker, "saved");
  assert.deepEqual(await second.state.keys.get("session", ["device-1"]), { "device-1": { key: "secret" } });
  second.close();
  await fsp.rm(directory, { recursive: true, force: true });
});

test("SQLite session lease prevents concurrent ownership", async () => {
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), "opensrc-wa-lease-"));
  const databasePath = path.join(directory, "leases.sqlite");
  const lock = new SqliteSessionLeaseLock(databasePath);
  const first = await lock.acquire("utama", 10_000);
  await assert.rejects(() => lock.acquire("utama", 10_000), /SESSION_LOCKED/);
  await first.renew();
  await first.release();
  const second = await lock.acquire("utama", 10_000);
  await second.release();
  await fsp.rm(directory, { recursive: true, force: true });
});

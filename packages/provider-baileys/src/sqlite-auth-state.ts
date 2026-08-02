import fsp = require("node:fs/promises");
import path = require("node:path");
import { DatabaseSync } from "node:sqlite";
import type { BaileysModule } from "./module-loader";

export interface SqliteAuthStateResult {
  state: any;
  saveCreds(): Promise<void>;
  close(): void;
}

export async function useSqliteAuthState(
  baileys: BaileysModule,
  databasePath: string,
  sessionId: string
): Promise<SqliteAuthStateResult> {
  await fsp.mkdir(path.dirname(databasePath), { recursive: true, mode: 0o700 });
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=5000;");
  database.exec(`
    CREATE TABLE IF NOT EXISTS provider_auth_state (
      session_id TEXT NOT NULL,
      category TEXT NOT NULL,
      item_key TEXT NOT NULL,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (session_id, category, item_key)
    )
  `);

  const selectOne = database.prepare(
    "SELECT value_json FROM provider_auth_state WHERE session_id = ? AND category = ? AND item_key = ?"
  );
  const upsertOne = database.prepare(`
    INSERT INTO provider_auth_state (session_id, category, item_key, value_json, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(session_id, category, item_key)
    DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
  `);
  const deleteOne = database.prepare(
    "DELETE FROM provider_auth_state WHERE session_id = ? AND category = ? AND item_key = ?"
  );

  const storedCreds = selectOne.get(sessionId, "creds", "state") as { value_json?: string } | undefined;
  const creds = storedCreds?.value_json
    ? deserialize(baileys, storedCreds.value_json)
    : createCredentials(baileys);

  const keys = {
    get: async (type: string, ids: string[]): Promise<Record<string, unknown>> => {
      const result: Record<string, unknown> = {};
      for (const id of ids) {
        const row = selectOne.get(sessionId, type, id) as { value_json?: string } | undefined;
        if (!row?.value_json) continue;
        let value = deserialize(baileys, row.value_json);
        if (type === "app-state-sync-key" && baileys.proto?.Message?.AppStateSyncKeyData?.fromObject) {
          value = baileys.proto.Message.AppStateSyncKeyData.fromObject(value);
        }
        result[id] = value;
      }
      return result;
    },
    set: async (data: Record<string, Record<string, unknown | null>>): Promise<void> => {
      database.exec("BEGIN IMMEDIATE");
      try {
        const now = new Date().toISOString();
        for (const [category, values] of Object.entries(data)) {
          for (const [itemKey, value] of Object.entries(values)) {
            if (value === null || value === undefined) deleteOne.run(sessionId, category, itemKey);
            else upsertOne.run(sessionId, category, itemKey, serialize(baileys, value), now);
          }
        }
        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    }
  };

  const state = { creds, keys };
  const saveCreds = async (): Promise<void> => {
    upsertOne.run(sessionId, "creds", "state", serialize(baileys, creds), new Date().toISOString());
  };

  return { state, saveCreds, close: () => database.close() };
}

function createCredentials(baileys: BaileysModule): unknown {
  if (typeof baileys.initAuthCreds !== "function") {
    throw new Error("Installed Baileys version does not expose initAuthCreds");
  }
  return baileys.initAuthCreds();
}

function serialize(baileys: BaileysModule, value: unknown): string {
  return JSON.stringify(value, baileys.BufferJSON?.replacer);
}

function deserialize(baileys: BaileysModule, value: string): any {
  return JSON.parse(value, baileys.BufferJSON?.reviver);
}

import path = require("node:path");
import fs = require("node:fs/promises");
import { DatabaseSync } from "node:sqlite";
import type { SessionRecord, SessionStore } from "./types";
import { AsyncMutex } from "./mutex";

export class SqliteSessionStore implements SessionStore {
  private readonly mutex = new AsyncMutex();
  private database: InstanceType<typeof DatabaseSync> | null = null;
  public constructor(private readonly filePath: string) {}

  private async db(): Promise<InstanceType<typeof DatabaseSync>> {
    if (this.database) return this.database;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
    const database = new DatabaseSync(this.filePath);
    database.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS session_keys (
        session_id TEXT NOT NULL,
        key_id TEXT NOT NULL,
        value_base64 TEXT NOT NULL,
        PRIMARY KEY (session_id, key_id)
      );
    `);
    this.database = database;
    return database;
  }

  public loadSession(sessionId: string): Promise<SessionRecord | null> {
    return this.mutex.run(async () => {
      const row = (await this.db()).prepare("SELECT payload FROM sessions WHERE session_id = ?").get(sessionId) as { payload?: string } | undefined;
      return row?.payload ? JSON.parse(row.payload) as SessionRecord : null;
    });
  }

  public listSessions(): Promise<SessionRecord[]> {
    return this.mutex.run(async () => {
      const rows = (await this.db()).prepare("SELECT payload FROM sessions ORDER BY updated_at DESC").all() as { payload: string }[];
      return rows.map((row) => JSON.parse(row.payload) as SessionRecord);
    });
  }

  public saveSession(session: SessionRecord): Promise<void> {
    return this.mutex.run(async () => {
      (await this.db()).prepare(`
        INSERT INTO sessions(session_id, payload, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
      `).run(session.sessionId, JSON.stringify(session), session.updatedAt);
    });
  }

  public deleteSession(sessionId: string): Promise<void> {
    return this.mutex.run(async () => {
      const database = await this.db();
      database.exec("BEGIN IMMEDIATE");
      try {
        database.prepare("DELETE FROM session_keys WHERE session_id = ?").run(sessionId);
        database.prepare("DELETE FROM sessions WHERE session_id = ?").run(sessionId);
        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    });
  }

  public getKey(sessionId: string, keyId: string): Promise<Uint8Array | null> {
    return this.mutex.run(async () => {
      const row = (await this.db()).prepare("SELECT value_base64 FROM session_keys WHERE session_id = ? AND key_id = ?").get(sessionId, keyId) as { value_base64?: string } | undefined;
      return row?.value_base64 ? new Uint8Array(Buffer.from(row.value_base64, "base64")) : null;
    });
  }

  public setKey(sessionId: string, keyId: string, value: Uint8Array): Promise<void> {
    return this.mutex.run(async () => {
      (await this.db()).prepare(`
        INSERT INTO session_keys(session_id, key_id, value_base64) VALUES (?, ?, ?)
        ON CONFLICT(session_id, key_id) DO UPDATE SET value_base64 = excluded.value_base64
      `).run(sessionId, keyId, Buffer.from(value).toString("base64"));
    });
  }

  public deleteKey(sessionId: string, keyId: string): Promise<void> {
    return this.mutex.run(async () => {
      (await this.db()).prepare("DELETE FROM session_keys WHERE session_id = ? AND key_id = ?").run(sessionId, keyId);
    });
  }

  public transaction<T>(callback: () => Promise<T>): Promise<T> {
    return this.mutex.run(callback);
  }
}

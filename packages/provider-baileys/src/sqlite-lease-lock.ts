import crypto = require("node:crypto");
import fsp = require("node:fs/promises");
import path = require("node:path");
import { DatabaseSync } from "node:sqlite";
import type { SessionLeaseHandle, SessionLeaseLock } from "../../provider-contract/src/lease-lock";
import { RedisSessionLeaseLock } from "./redis-lease-lock";

/**
 * Compatibility facade used by the live gateway. A filesystem path selects
 * SQLite single-host leasing; a redis:// or rediss:// URL selects the Redis
 * distributed lease implementation.
 */
export class SqliteSessionLeaseLock implements SessionLeaseLock {
  public constructor(private readonly databasePathOrRedisUrl: string) {}

  public async acquire(sessionId: string, ttlMs: number): Promise<SessionLeaseHandle> {
    if (/^rediss?:\/\//i.test(this.databasePathOrRedisUrl)) {
      return new RedisSessionLeaseLock({ url: this.databasePathOrRedisUrl }).acquire(sessionId, ttlMs);
    }
    if (!Number.isInteger(ttlMs) || ttlMs < 5_000) throw new Error("ttlMs minimal 5000");
    await fsp.mkdir(path.dirname(this.databasePathOrRedisUrl), { recursive: true, mode: 0o700 });
    const database = new DatabaseSync(this.databasePathOrRedisUrl);
    database.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=5000;");
    database.exec(`
      CREATE TABLE IF NOT EXISTS provider_session_leases (
        session_id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    const ownerId = crypto.randomUUID();
    const select = database.prepare("SELECT owner_id, expires_at FROM provider_session_leases WHERE session_id = ?");
    const upsert = database.prepare(`
      INSERT INTO provider_session_leases (session_id, owner_id, expires_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        owner_id = excluded.owner_id,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at
    `);

    database.exec("BEGIN IMMEDIATE");
    try {
      const current = select.get(sessionId) as { owner_id?: string; expires_at?: number } | undefined;
      const now = Date.now();
      if (current?.owner_id && Number(current.expires_at) > now) throw new Error(`SESSION_LOCKED:${sessionId}`);
      upsert.run(sessionId, ownerId, now + ttlMs, new Date().toISOString());
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      database.close();
      throw error;
    }

    let released = false;
    return {
      sessionId,
      ownerId,
      renew: async () => {
        if (released) throw new Error("SESSION_LEASE_RELEASED");
        const result = database.prepare(`
          UPDATE provider_session_leases
          SET expires_at = ?, updated_at = ?
          WHERE session_id = ? AND owner_id = ?
        `).run(Date.now() + ttlMs, new Date().toISOString(), sessionId, ownerId) as { changes?: number };
        if (Number(result.changes ?? 0) !== 1) throw new Error(`SESSION_LEASE_LOST:${sessionId}`);
      },
      release: async () => {
        if (released) return;
        released = true;
        database.prepare("DELETE FROM provider_session_leases WHERE session_id = ? AND owner_id = ?").run(sessionId, ownerId);
        database.close();
      }
    };
  }
}

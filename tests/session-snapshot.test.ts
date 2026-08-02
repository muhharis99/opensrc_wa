import test = require("node:test");
import assert = require("node:assert/strict");
import { PairingController } from "../packages/auth/src/pairing-controller";
import { SessionManager } from "../packages/auth/src/session-manager";
import type { SessionRecord, SessionStore } from "../packages/session-store/src/types";

class MemoryStore implements SessionStore {
  private readonly sessions = new Map<string, SessionRecord>();
  public loadSession(id: string): Promise<SessionRecord | null> { return Promise.resolve(this.sessions.get(id) ?? null); }
  public listSessions(): Promise<SessionRecord[]> { return Promise.resolve([...this.sessions.values()]); }
  public saveSession(session: SessionRecord): Promise<void> { this.sessions.set(session.sessionId, { ...session, metadata: { ...session.metadata } }); return Promise.resolve(); }
  public deleteSession(id: string): Promise<void> { this.sessions.delete(id); return Promise.resolve(); }
  public getKey(): Promise<Uint8Array | null> { return Promise.resolve(null); }
  public setKey(): Promise<void> { return Promise.resolve(); }
  public deleteKey(): Promise<void> { return Promise.resolve(); }
  public transaction<T>(callback: () => Promise<T>): Promise<T> { return callback(); }
}

test("mock session snapshot exports and imports without live credential claims", async () => {
  const source = new SessionManager(new MemoryStore(), new PairingController(), "mock");
  await source.create("backup");
  await source.connect("backup");
  await source.completeMockPairing("backup");
  const snapshot = await source.exportMockSnapshot("backup");
  assert.equal(snapshot.protocolStatus, "TESTED_WITH_MOCK");

  const target = new SessionManager(new MemoryStore(), new PairingController(), "mock");
  const imported = await target.importMockSnapshot({ version: 1, session: snapshot.session });
  assert.equal(imported.sessionId, "backup");
  assert.equal(imported.metadata.imported, "true");
});

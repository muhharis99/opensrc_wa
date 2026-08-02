import type { SessionState } from "../../core/src/types";

export interface SessionRecord {
  version: 1;
  sessionId: string;
  state: SessionState;
  createdAt: string;
  updatedAt: string;
  credentialVersion: number;
  metadata: Record<string, string>;
}

export interface SessionStore {
  loadSession(sessionId: string): Promise<SessionRecord | null>;
  listSessions(): Promise<SessionRecord[]>;
  saveSession(session: SessionRecord): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  getKey(sessionId: string, keyId: string): Promise<Uint8Array | null>;
  setKey(sessionId: string, keyId: string, value: Uint8Array): Promise<void>;
  deleteKey(sessionId: string, keyId: string): Promise<void>;
  transaction<T>(callback: () => Promise<T>): Promise<T>;
}

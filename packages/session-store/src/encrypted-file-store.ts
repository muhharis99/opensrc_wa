import fs = require("node:fs/promises");
import path = require("node:path");
import { CryptoProvider, type EncryptedEnvelope } from "../../crypto/src/crypto-provider";
import type { SessionRecord, SessionStore } from "./types";
import { AsyncMutex } from "./mutex";

interface StoreDocument {
  version: 1;
  sessions: Record<string, SessionRecord>;
  keys: Record<string, string>;
}

export class EncryptedFileSessionStore implements SessionStore {
  private readonly mutex = new AsyncMutex();
  private readonly crypto = new CryptoProvider();
  private readonly filePath: string;

  public constructor(directory: string, private readonly key: Uint8Array) {
    if (key.byteLength !== 32) throw new Error("Session encryption key must be 32 bytes");
    this.filePath = path.join(directory, "sessions.enc.json");
  }

  public loadSession(sessionId: string): Promise<SessionRecord | null> {
    return this.mutex.run(async () => (await this.read()).sessions[sessionId] ?? null);
  }

  public listSessions(): Promise<SessionRecord[]> {
    return this.mutex.run(async () => Object.values((await this.read()).sessions));
  }

  public saveSession(session: SessionRecord): Promise<void> {
    return this.mutex.run(async () => {
      const data = await this.read();
      data.sessions[session.sessionId] = session;
      await this.write(data);
    });
  }

  public deleteSession(sessionId: string): Promise<void> {
    return this.mutex.run(async () => {
      const data = await this.read();
      delete data.sessions[sessionId];
      for (const key of Object.keys(data.keys)) if (key.startsWith(`${sessionId}:`)) delete data.keys[key];
      await this.write(data);
    });
  }

  public getKey(sessionId: string, keyId: string): Promise<Uint8Array | null> {
    return this.mutex.run(async () => {
      const value = (await this.read()).keys[`${sessionId}:${keyId}`];
      return value ? new Uint8Array(Buffer.from(value, "base64")) : null;
    });
  }

  public setKey(sessionId: string, keyId: string, value: Uint8Array): Promise<void> {
    return this.mutex.run(async () => {
      const data = await this.read();
      data.keys[`${sessionId}:${keyId}`] = Buffer.from(value).toString("base64");
      await this.write(data);
    });
  }

  public deleteKey(sessionId: string, keyId: string): Promise<void> {
    return this.mutex.run(async () => {
      const data = await this.read();
      delete data.keys[`${sessionId}:${keyId}`];
      await this.write(data);
    });
  }

  public transaction<T>(callback: () => Promise<T>): Promise<T> {
    return this.mutex.run(callback);
  }

  private async read(): Promise<StoreDocument> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const envelope = JSON.parse(raw) as EncryptedEnvelope;
      return this.crypto.decryptJson<StoreDocument>(envelope, this.key);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        return { version: 1, sessions: {}, keys: {} };
      }
      throw error;
    }
  }

  private async write(data: StoreDocument): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
    const temporary = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    const envelope = this.crypto.encryptJson(data, this.key);
    await fs.writeFile(temporary, `${JSON.stringify(envelope)}\n`, { mode: 0o600 });
    await fs.rename(temporary, this.filePath);
  }
}

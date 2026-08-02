import crypto = require("node:crypto");
import { OpenSrcWaError } from "../../core/src/errors";
import { SessionStateMachine } from "../../core/src/state-machine";
import { TypedEventEmitter } from "../../core/src/typed-events";
import type { BaseEvent, SessionState } from "../../core/src/types";
import type { SessionRecord, SessionStore } from "../../session-store/src/types";
import { PairingController, type PairingChallenge } from "./pairing-controller";

interface SessionEvents {
  "connection.update": BaseEvent & { state: SessionState };
  "pairing.qr": BaseEvent & { challenge: PairingChallenge };
  "session.ready": BaseEvent;
  "credentials.updated": BaseEvent & { credentialVersion: number };
  "logged.out": BaseEvent;
}

export class SessionManager extends TypedEventEmitter<SessionEvents> {
  private readonly machines = new Map<string, SessionStateMachine>();
  public constructor(
    private readonly store: SessionStore,
    private readonly pairing: PairingController,
    private readonly protocolMode: "mock" | "research"
  ) {
    super();
    pairing.on("pairing.qr", async (challenge) => {
      await this.emit("pairing.qr", { ...this.base(challenge.sessionId, "pairing.qr"), challenge });
    });
  }

  public async create(sessionId: string): Promise<SessionRecord> {
    if (await this.store.loadSession(sessionId)) throw new OpenSrcWaError({ code: "SESSION_EXISTS", category: "SESSION_ERROR", message: "Session sudah ada" });
    const now = new Date().toISOString();
    const record: SessionRecord = { version: 1, sessionId, state: "DISCONNECTED", createdAt: now, updatedAt: now, credentialVersion: 0, metadata: { protocolMode: this.protocolMode } };
    await this.store.saveSession(record);
    this.machines.set(sessionId, new SessionStateMachine());
    return record;
  }

  public list(): Promise<SessionRecord[]> { return this.store.listSessions(); }

  public async get(sessionId: string): Promise<SessionRecord> {
    const record = await this.store.loadSession(sessionId);
    if (!record) throw new OpenSrcWaError({ code: "SESSION_NOT_FOUND", category: "SESSION_ERROR", message: "Session tidak ditemukan" });
    return record;
  }

  public async connect(sessionId: string): Promise<SessionRecord> {
    const current = await this.get(sessionId);
    const machine = this.machine(current);
    await this.move(current, machine, "CONNECTING");
    if (this.protocolMode === "research") {
      await this.move(current, machine, "ERROR");
      throw new OpenSrcWaError({
        code: "LIVE_PROTOCOL_BLOCKED",
        category: "PROTOCOL_ERROR",
        message: "Koneksi live diblokir sampai endpoint, schema, dan handshake tervalidasi melalui riset clean-room",
        details: { status: "BLOCKED" }
      });
    }
    await this.move(current, machine, "AWAITING_PAIRING");
    this.pairing.createMockChallenge(sessionId);
    return this.get(sessionId);
  }

  public async completeMockPairing(sessionId: string): Promise<SessionRecord> {
    if (this.protocolMode !== "mock") throw new OpenSrcWaError({ code: "MOCK_ONLY", category: "PAIRING_ERROR", message: "Endpoint pairing mock hanya tersedia pada mode mock" });
    const current = await this.get(sessionId);
    const machine = this.machine(current);
    await this.move(current, machine, "PAIRING");
    await this.move(current, machine, "AUTHENTICATED");
    current.credentialVersion += 1;
    current.updatedAt = new Date().toISOString();
    await this.store.saveSession(current);
    await this.emit("credentials.updated", { ...this.base(sessionId, "credentials.updated"), credentialVersion: current.credentialVersion });
    await this.move(current, machine, "SYNCING");
    await this.move(current, machine, "READY");
    this.pairing.clear(sessionId);
    await this.emit("session.ready", this.base(sessionId, "session.ready"));
    return this.get(sessionId);
  }

  public async disconnect(sessionId: string): Promise<SessionRecord> {
    const current = await this.get(sessionId);
    const machine = this.machine(current);
    if (machine.getState() !== "DISCONNECTED") await this.move(current, machine, "DISCONNECTED");
    return this.get(sessionId);
  }

  public async logout(sessionId: string): Promise<SessionRecord> {
    const current = await this.get(sessionId);
    const machine = this.machine(current);
    if (machine.getState() !== "LOGGED_OUT") await this.move(current, machine, "LOGGED_OUT");
    this.pairing.clear(sessionId);
    await this.emit("logged.out", this.base(sessionId, "logged.out"));
    return this.get(sessionId);
  }

  public async delete(sessionId: string): Promise<void> {
    await this.store.deleteSession(sessionId);
    this.machines.delete(sessionId);
    this.pairing.clear(sessionId);
  }

  public getPairing(sessionId: string): PairingChallenge | null { return this.pairing.get(sessionId); }

  private machine(record: SessionRecord): SessionStateMachine {
    const existing = this.machines.get(record.sessionId);
    if (existing) return existing;
    const machine = new SessionStateMachine(record.state);
    this.machines.set(record.sessionId, machine);
    return machine;
  }

  private async move(record: SessionRecord, machine: SessionStateMachine, state: SessionState): Promise<void> {
    machine.transition(state);
    record.state = state;
    record.updatedAt = new Date().toISOString();
    await this.store.saveSession(record);
    await this.emit("connection.update", { ...this.base(record.sessionId, "connection.update"), state });
  }

  private base(sessionId: string, eventName: string): BaseEvent {
    return { eventId: crypto.randomUUID(), eventName, eventVersion: 1, sessionId, timestamp: new Date().toISOString() };
  }
}

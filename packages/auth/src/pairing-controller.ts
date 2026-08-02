import crypto = require("node:crypto");
import { TypedEventEmitter } from "../../core/src/typed-events";

export interface PairingChallenge {
  sessionId: string;
  challengeId: string;
  payload: string;
  expiresAt: string;
  mode: "mock";
  method: "qr" | "pairing-code";
  phone: string | null;
}

interface PairingEvents {
  "pairing.qr": PairingChallenge;
  "pairing.code": PairingChallenge;
  "pairing.expired": { sessionId: string; challengeId: string };
}

export class PairingController extends TypedEventEmitter<PairingEvents> {
  private readonly active = new Map<string, PairingChallenge>();

  public createMockChallenge(sessionId: string, ttlMs = 60_000): PairingChallenge {
    return this.create(sessionId, "qr", null, `opensrc_wa_mock:${sessionId}:${crypto.randomBytes(24).toString("base64url")}`, ttlMs);
  }

  public createMockPairingCode(sessionId: string, phone: string, ttlMs = 60_000): PairingChallenge {
    const code = `${crypto.randomInt(1000, 9999)}-${crypto.randomInt(1000, 9999)}`;
    return this.create(sessionId, "pairing-code", phone, code, ttlMs);
  }

  public get(sessionId: string): PairingChallenge | null {
    const challenge = this.active.get(sessionId);
    if (!challenge) return null;
    if (Date.parse(challenge.expiresAt) <= Date.now()) {
      this.active.delete(sessionId);
      return null;
    }
    return { ...challenge };
  }

  public clear(sessionId: string): void { this.active.delete(sessionId); }

  private create(sessionId: string, method: PairingChallenge["method"], phone: string | null, payload: string, ttlMs: number): PairingChallenge {
    const challenge: PairingChallenge = {
      sessionId,
      challengeId: crypto.randomUUID(),
      payload,
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
      mode: "mock",
      method,
      phone
    };
    this.active.set(sessionId, challenge);
    void this.emit(method === "qr" ? "pairing.qr" : "pairing.code", challenge);
    const timer = setTimeout(() => {
      const current = this.active.get(sessionId);
      if (current?.challengeId === challenge.challengeId) {
        this.active.delete(sessionId);
        void this.emit("pairing.expired", { sessionId, challengeId: challenge.challengeId });
      }
    }, ttlMs);
    (timer as unknown as { unref?: () => void }).unref?.();
    return { ...challenge };
  }
}

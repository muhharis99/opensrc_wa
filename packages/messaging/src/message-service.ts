import crypto = require("node:crypto");
import { DeduplicationWindow } from "../../core/src/deduplication";
import { IdempotencyStore } from "../../core/src/idempotency";
import { OpenSrcWaError } from "../../core/src/errors";
import { TypedEventEmitter } from "../../core/src/typed-events";
import type { BaseEvent } from "../../core/src/types";
import type { SessionManager } from "../../auth/src/session-manager";

export type MessageStatus = "queued" | "sent" | "acknowledged" | "failed";

export interface MessageRecord {
  messageId: string;
  sessionId: string;
  to: string;
  text: string;
  direction: "outgoing";
  status: MessageStatus;
  timestamp: string;
  idempotencyKey: string;
}

interface MessageEvents {
  "message.sent": BaseEvent & { messageId: string; to: string };
  "message.ack": BaseEvent & { messageId: string };
  "message.failed": BaseEvent & { messageId: string; code: string };
}

export class MessageService extends TypedEventEmitter<MessageEvents> {
  private readonly records = new Map<string, MessageRecord>();
  private readonly idempotency = new IdempotencyStore<MessageRecord>(24 * 60 * 60 * 1000);
  private readonly dedupe = new DeduplicationWindow(24 * 60 * 60 * 1000);

  public constructor(private readonly sessions: SessionManager, private readonly protocolMode: "mock" | "research") { super(); }

  public async sendText(input: { sessionId: string; to: string; text: string; idempotencyKey: string }): Promise<MessageRecord> {
    const existing = this.idempotency.get(input.idempotencyKey);
    if (existing) return existing;
    const session = await this.sessions.get(input.sessionId);
    if (session.state !== "READY") throw new OpenSrcWaError({ code: "SESSION_NOT_READY", category: "MESSAGE_ERROR", message: "Session belum siap digunakan" });
    if (this.protocolMode !== "mock") throw new OpenSrcWaError({ code: "LIVE_SEND_BLOCKED", category: "PROTOCOL_ERROR", message: "Pengiriman live belum diimplementasikan dan berstatus BLOCKED" });
    if (!/^\d{8,16}$/.test(input.to)) throw new OpenSrcWaError({ code: "INVALID_RECIPIENT", category: "VALIDATION_ERROR", message: "Nomor tujuan harus berupa 8-16 digit" });
    const message: MessageRecord = {
      messageId: crypto.randomUUID(), sessionId: input.sessionId, to: input.to, text: input.text,
      direction: "outgoing", status: "sent", timestamp: new Date().toISOString(), idempotencyKey: input.idempotencyKey
    };
    if (!this.dedupe.accept(message.messageId)) throw new OpenSrcWaError({ code: "DUPLICATE_MESSAGE", category: "MESSAGE_ERROR", message: "Duplicate message suppressed" });
    this.records.set(message.messageId, message);
    this.idempotency.set(input.idempotencyKey, message);
    await this.emit("message.sent", { ...this.base(input.sessionId, "message.sent"), messageId: message.messageId, to: input.to });
    return message;
  }

  public get(messageId: string): MessageRecord | null { return this.records.get(messageId) ?? null; }

  private base(sessionId: string, eventName: string): BaseEvent {
    return { eventId: crypto.randomUUID(), eventName, eventVersion: 1, sessionId, timestamp: new Date().toISOString() };
  }
}

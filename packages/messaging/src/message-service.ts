import crypto = require("node:crypto");
import { DeduplicationWindow } from "../../core/src/deduplication";
import { IdempotencyStore } from "../../core/src/idempotency";
import { OpenSrcWaError } from "../../core/src/errors";
import { TypedEventEmitter } from "../../core/src/typed-events";
import type { BaseEvent } from "../../core/src/types";
import type { SessionManager } from "../../auth/src/session-manager";
import type { ChatService, ContactService } from "../../domain/src";

export type MessageStatus = "queued" | "sent" | "delivered" | "read" | "played" | "failed" | "deleted";
export type MessageType = "text" | "image" | "video" | "audio" | "document" | "sticker" | "location" | "contact" | "poll" | "system";
export interface MessageReaction { jid: string; emoji: string; timestamp: string; }
export interface MessageReceipt { jid: string; status: "delivered" | "read" | "played"; timestamp: string; }
export interface MessageRecord {
  messageId: string;
  sessionId: string;
  chatId: string;
  from: string;
  to: string;
  type: MessageType;
  text: string;
  content: Record<string, unknown>;
  direction: "incoming" | "outgoing";
  status: MessageStatus;
  timestamp: string;
  idempotencyKey: string | null;
  quotedMessageId: string | null;
  forwardedFrom: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  reactions: MessageReaction[];
  receipts: MessageReceipt[];
  protocolStatus: "TESTED_WITH_MOCK";
}

interface MessageEvents {
  "message.received": BaseEvent & { messageId: string; from: string; chatId: string };
  "message.sent": BaseEvent & { messageId: string; to: string; chatId: string };
  "message.ack": BaseEvent & { messageId: string; status: MessageStatus };
  "message.updated": BaseEvent & { messageId: string; operation: string };
  "message.failed": BaseEvent & { messageId: string; code: string };
}

export interface MessageServiceDependencies {
  chats?: ChatService;
  contacts?: ContactService;
  runHook?: (hook: "message.before_send" | "message.after_send" | "message.received", sessionId: string, payload: unknown) => Promise<unknown[]>;
}

export class MessageService extends TypedEventEmitter<MessageEvents> {
  private readonly records = new Map<string, MessageRecord>();
  private readonly idempotency = new IdempotencyStore<MessageRecord>(24 * 60 * 60 * 1000);
  private readonly dedupe = new DeduplicationWindow(24 * 60 * 60 * 1000);

  public constructor(
    private readonly sessions: SessionManager,
    private readonly protocolMode: "mock" | "research",
    private readonly dependencies: MessageServiceDependencies = {}
  ) { super(); }

  public sendText(input: { sessionId: string; to: string; text: string; idempotencyKey: string; quotedMessageId?: string; viewOnce?: boolean; disappearingSeconds?: number }): Promise<MessageRecord> {
    return this.sendOutgoing({
      sessionId: input.sessionId,
      to: input.to,
      type: "text",
      text: input.text,
      content: {
        view_once: input.viewOnce ?? false,
        disappearing_seconds: input.disappearingSeconds ?? null
      },
      idempotencyKey: input.idempotencyKey,
      ...(input.quotedMessageId ? { quotedMessageId: input.quotedMessageId } : {})
    });
  }

  public sendMedia(input: { sessionId: string; to: string; mediaId: string; mediaType: "image" | "video" | "audio" | "document" | "sticker"; caption?: string; idempotencyKey: string; quotedMessageId?: string; viewOnce?: boolean }): Promise<MessageRecord> {
    return this.sendOutgoing({
      sessionId: input.sessionId,
      to: input.to,
      type: input.mediaType,
      text: input.caption ?? "",
      content: { media_id: input.mediaId, caption: input.caption ?? null, view_once: input.viewOnce ?? false },
      idempotencyKey: input.idempotencyKey,
      ...(input.quotedMessageId ? { quotedMessageId: input.quotedMessageId } : {})
    });
  }

  public sendLocation(input: { sessionId: string; to: string; latitude: number; longitude: number; name?: string; address?: string; livePeriodSeconds?: number; idempotencyKey: string }): Promise<MessageRecord> {
    if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90 || !Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) {
      throw new OpenSrcWaError({ code: "INVALID_LOCATION", category: "VALIDATION_ERROR", message: "Koordinat lokasi tidak valid" });
    }
    return this.sendOutgoing({ sessionId: input.sessionId, to: input.to, type: "location", text: input.name ?? "", content: { latitude: input.latitude, longitude: input.longitude, name: input.name ?? null, address: input.address ?? null, live_period_seconds: input.livePeriodSeconds ?? null }, idempotencyKey: input.idempotencyKey });
  }

  public sendContact(input: { sessionId: string; to: string; displayName: string; vcard: string; idempotencyKey: string }): Promise<MessageRecord> {
    return this.sendOutgoing({ sessionId: input.sessionId, to: input.to, type: "contact", text: input.displayName, content: { display_name: input.displayName, vcard: input.vcard }, idempotencyKey: input.idempotencyKey });
  }

  public sendPoll(input: { sessionId: string; to: string; question: string; options: string[]; selectableCount?: number; idempotencyKey: string }): Promise<MessageRecord> {
    const options = [...new Set(input.options.map((option) => option.trim()).filter(Boolean))];
    if (options.length < 2 || options.length > 12) throw new OpenSrcWaError({ code: "INVALID_POLL", category: "VALIDATION_ERROR", message: "Poll membutuhkan 2-12 pilihan unik" });
    const selectableCount = input.selectableCount ?? 1;
    if (!Number.isInteger(selectableCount) || selectableCount < 1 || selectableCount > options.length) throw new OpenSrcWaError({ code: "INVALID_POLL", category: "VALIDATION_ERROR", message: "selectable_count tidak valid" });
    return this.sendOutgoing({ sessionId: input.sessionId, to: input.to, type: "poll", text: input.question, content: { question: input.question, options, selectable_count: selectableCount, votes: {} }, idempotencyKey: input.idempotencyKey });
  }

  public async react(sessionId: string, messageId: string, jid: string, emoji: string): Promise<MessageRecord> {
    const record = this.mutable(sessionId, messageId);
    record.reactions = record.reactions.filter((reaction) => reaction.jid !== jid);
    if (emoji) record.reactions.push({ jid, emoji, timestamp: new Date().toISOString() });
    await this.emit("message.updated", { ...this.base(sessionId, "message.updated"), messageId, operation: "reaction" });
    return clone(record);
  }

  public async edit(sessionId: string, messageId: string, text: string): Promise<MessageRecord> {
    const record = this.mutable(sessionId, messageId);
    if (record.direction !== "outgoing" || record.deletedAt) throw new OpenSrcWaError({ code: "MESSAGE_NOT_EDITABLE", category: "MESSAGE_ERROR", message: "Pesan tidak dapat diedit" });
    record.text = text;
    record.editedAt = new Date().toISOString();
    await this.emit("message.updated", { ...this.base(sessionId, "message.updated"), messageId, operation: "edit" });
    return clone(record);
  }

  public async delete(sessionId: string, messageId: string, scope: "self" | "everyone"): Promise<MessageRecord> {
    const record = this.mutable(sessionId, messageId);
    record.deletedAt = new Date().toISOString();
    record.status = "deleted";
    record.content = { deleted_scope: scope };
    record.text = "";
    await this.emit("message.updated", { ...this.base(sessionId, "message.updated"), messageId, operation: `delete:${scope}` });
    return clone(record);
  }

  public async forward(sessionId: string, messageId: string, to: string, idempotencyKey: string): Promise<MessageRecord> {
    const source = this.mutable(sessionId, messageId);
    return this.sendOutgoing({ sessionId, to, type: source.type, text: source.text, content: { ...source.content }, idempotencyKey, forwardedFrom: source.messageId });
  }

  public async setReceipt(sessionId: string, messageId: string, jid: string, status: "delivered" | "read" | "played"): Promise<MessageRecord> {
    const record = this.mutable(sessionId, messageId);
    record.receipts = record.receipts.filter((receipt) => !(receipt.jid === jid && receipt.status === status));
    record.receipts.push({ jid, status, timestamp: new Date().toISOString() });
    record.status = status;
    await this.emit("message.ack", { ...this.base(sessionId, "message.ack"), messageId, status });
    return clone(record);
  }

  public async injectIncoming(input: { sessionId: string; from: string; chatId?: string; type?: MessageType; text?: string; content?: Record<string, unknown>; messageId?: string; quotedMessageId?: string }): Promise<MessageRecord> {
    if (this.protocolMode !== "mock") throw new OpenSrcWaError({ code: "MOCK_ONLY", category: "PROTOCOL_ERROR", message: "Injeksi pesan hanya tersedia pada mode mock" });
    await this.assertReady(input.sessionId);
    const messageId = input.messageId ?? crypto.randomUUID();
    if (!this.dedupe.accept(messageId)) {
      const existing = this.records.get(messageId);
      if (existing) return clone(existing);
      throw new OpenSrcWaError({ code: "DUPLICATE_MESSAGE", category: "MESSAGE_ERROR", message: "Pesan duplikat ditolak" });
    }
    const chatId = input.chatId ?? normalizeChatId(input.from);
    const record: MessageRecord = {
      messageId,
      sessionId: input.sessionId,
      chatId,
      from: input.from,
      to: "self",
      type: input.type ?? "text",
      text: input.text ?? "",
      content: { ...(input.content ?? {}) },
      direction: "incoming",
      status: "delivered",
      timestamp: new Date().toISOString(),
      idempotencyKey: null,
      quotedMessageId: input.quotedMessageId ?? null,
      forwardedFrom: null,
      editedAt: null,
      deletedAt: null,
      reactions: [],
      receipts: [],
      protocolStatus: "TESTED_WITH_MOCK"
    };
    this.records.set(messageId, record);
    this.dependencies.chats?.touch(input.sessionId, chatId, true);
    await this.emit("message.received", { ...this.base(input.sessionId, "message.received"), messageId, from: input.from, chatId });
    await this.dependencies.runHook?.("message.received", input.sessionId, clone(record));
    return clone(record);
  }

  public get(messageId: string): MessageRecord | null {
    const record = this.records.get(messageId);
    return record ? clone(record) : null;
  }

  public list(filter?: { sessionId?: string; chatId?: string; direction?: MessageRecord["direction"]; type?: MessageType; query?: string }): MessageRecord[] {
    const query = filter?.query?.toLowerCase();
    return [...this.records.values()]
      .filter((record) => !filter?.sessionId || record.sessionId === filter.sessionId)
      .filter((record) => !filter?.chatId || record.chatId === filter.chatId)
      .filter((record) => !filter?.direction || record.direction === filter.direction)
      .filter((record) => !filter?.type || record.type === filter.type)
      .filter((record) => !query || record.text.toLowerCase().includes(query))
      .map(clone)
      .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  }

  private async sendOutgoing(input: { sessionId: string; to: string; type: MessageType; text: string; content: Record<string, unknown>; idempotencyKey: string; quotedMessageId?: string; forwardedFrom?: string }): Promise<MessageRecord> {
    const existing = this.idempotency.get(input.idempotencyKey);
    if (existing) return clone(existing);
    await this.assertReady(input.sessionId);
    if (this.protocolMode !== "mock") throw new OpenSrcWaError({ code: "LIVE_SEND_BLOCKED", category: "PROTOCOL_ERROR", message: "Pengiriman live belum tervalidasi dan berstatus BLOCKED" });
    validateRecipient(input.to);
    const phone = input.to.replace(/@s\.whatsapp\.net$/, "");
    if (/^\d+$/.test(phone)) this.dependencies.contacts?.assertCanMessage(input.sessionId, phone);
    if (input.quotedMessageId && !this.records.has(input.quotedMessageId)) throw new OpenSrcWaError({ code: "QUOTED_MESSAGE_NOT_FOUND", category: "MESSAGE_ERROR", message: "Pesan kutipan tidak ditemukan" });
    const chatId = normalizeChatId(input.to);
    await this.dependencies.runHook?.("message.before_send", input.sessionId, { ...input, content: { ...input.content } });
    const message: MessageRecord = {
      messageId: crypto.randomUUID(),
      sessionId: input.sessionId,
      chatId,
      from: "self",
      to: input.to,
      type: input.type,
      text: input.text,
      content: { ...input.content },
      direction: "outgoing",
      status: "sent",
      timestamp: new Date().toISOString(),
      idempotencyKey: input.idempotencyKey,
      quotedMessageId: input.quotedMessageId ?? null,
      forwardedFrom: input.forwardedFrom ?? null,
      editedAt: null,
      deletedAt: null,
      reactions: [],
      receipts: [],
      protocolStatus: "TESTED_WITH_MOCK"
    };
    if (!this.dedupe.accept(message.messageId)) throw new OpenSrcWaError({ code: "DUPLICATE_MESSAGE", category: "MESSAGE_ERROR", message: "Pesan duplikat ditolak" });
    this.records.set(message.messageId, message);
    this.idempotency.set(input.idempotencyKey, message);
    this.dependencies.chats?.touch(input.sessionId, chatId, false);
    await this.emit("message.sent", { ...this.base(input.sessionId, "message.sent"), messageId: message.messageId, to: input.to, chatId });
    await this.dependencies.runHook?.("message.after_send", input.sessionId, clone(message));
    return clone(message);
  }

  private async assertReady(sessionId: string): Promise<void> {
    const session = await this.sessions.get(sessionId);
    if (session.state !== "READY") throw new OpenSrcWaError({ code: "SESSION_NOT_READY", category: "MESSAGE_ERROR", message: "Session belum siap digunakan" });
  }

  private mutable(sessionId: string, messageId: string): MessageRecord {
    const record = this.records.get(messageId);
    if (!record || record.sessionId !== sessionId) throw new OpenSrcWaError({ code: "MESSAGE_NOT_FOUND", category: "MESSAGE_ERROR", message: "Pesan tidak ditemukan" });
    return record;
  }

  private base(sessionId: string, eventName: string): BaseEvent {
    return { eventId: crypto.randomUUID(), eventName, eventVersion: 1, sessionId, timestamp: new Date().toISOString() };
  }
}

function normalizeChatId(recipient: string): string {
  if (recipient.includes("@")) return recipient;
  return `${recipient}@s.whatsapp.net`;
}
function validateRecipient(recipient: string): void {
  if (/^\d{8,16}$/.test(recipient)) return;
  if (/^[a-zA-Z0-9_.:-]{3,128}@(s\.whatsapp\.net|g\.us|newsletter|community)$/.test(recipient)) return;
  throw new OpenSrcWaError({ code: "INVALID_RECIPIENT", category: "VALIDATION_ERROR", message: "Tujuan harus nomor 8-16 digit atau JID yang valid" });
}
function clone(record: MessageRecord): MessageRecord {
  return { ...record, content: { ...record.content }, reactions: record.reactions.map((reaction) => ({ ...reaction })), receipts: record.receipts.map((receipt) => ({ ...receipt })) };
}

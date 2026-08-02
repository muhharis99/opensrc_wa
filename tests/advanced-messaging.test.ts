import test = require("node:test");
import assert = require("node:assert/strict");
import { PairingController } from "../packages/auth/src/pairing-controller";
import { SessionManager } from "../packages/auth/src/session-manager";
import { MessageService } from "../packages/messaging/src/message-service";
import { ChatService, ContactService } from "../packages/domain/src";
import type { SessionRecord, SessionStore } from "../packages/session-store/src/types";

class MemoryStore implements SessionStore {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly keys = new Map<string, Uint8Array>();
  public loadSession(id: string): Promise<SessionRecord | null> { return Promise.resolve(this.sessions.get(id) ?? null); }
  public listSessions(): Promise<SessionRecord[]> { return Promise.resolve([...this.sessions.values()]); }
  public saveSession(session: SessionRecord): Promise<void> { this.sessions.set(session.sessionId, { ...session, metadata: { ...session.metadata } }); return Promise.resolve(); }
  public deleteSession(id: string): Promise<void> { this.sessions.delete(id); return Promise.resolve(); }
  public getKey(sessionId: string, keyId: string): Promise<Uint8Array | null> { return Promise.resolve(this.keys.get(`${sessionId}:${keyId}`) ?? null); }
  public setKey(sessionId: string, keyId: string, value: Uint8Array): Promise<void> { this.keys.set(`${sessionId}:${keyId}`, new Uint8Array(value)); return Promise.resolve(); }
  public deleteKey(sessionId: string, keyId: string): Promise<void> { this.keys.delete(`${sessionId}:${keyId}`); return Promise.resolve(); }
  public transaction<T>(callback: () => Promise<T>): Promise<T> { return callback(); }
}

async function runtime(): Promise<MessageService> {
  const sessions = new SessionManager(new MemoryStore(), new PairingController(), "mock");
  await sessions.create("s1");
  await sessions.connect("s1");
  await sessions.completeMockPairing("s1");
  const contacts = new ContactService();
  contacts.grantConsent("s1", "6281234567890", "test opt-in");
  return new MessageService(sessions, "mock", { contacts, chats: new ChatService() });
}

test("advanced messaging covers replies, reactions, edits, receipts, forwards, polls, and inbound events", async () => {
  const messages = await runtime();
  const first = await messages.sendText({ sessionId: "s1", to: "6281234567890", text: "hello", idempotencyKey: "advanced-0001" });
  const reply = await messages.sendText({ sessionId: "s1", to: "6281234567890", text: "reply", idempotencyKey: "advanced-0002", quotedMessageId: first.messageId });
  assert.equal(reply.quotedMessageId, first.messageId);
  assert.equal((await messages.react("s1", first.messageId, "6281@s.whatsapp.net", "👍")).reactions.length, 1);
  assert.equal((await messages.edit("s1", first.messageId, "edited")).text, "edited");
  assert.equal((await messages.setReceipt("s1", first.messageId, "6281@s.whatsapp.net", "read")).status, "read");
  assert.equal((await messages.forward("s1", first.messageId, "6281234567890", "advanced-0003")).forwardedFrom, first.messageId);
  const poll = await messages.sendPoll({ sessionId: "s1", to: "6281234567890", question: "Choose", options: ["A", "B"], idempotencyKey: "advanced-0004" });
  assert.equal(poll.type, "poll");
  const incoming = await messages.injectIncoming({ sessionId: "s1", from: "6281234567890", text: "incoming" });
  assert.equal(incoming.direction, "incoming");
  assert.equal(messages.list({ sessionId: "s1" }).length, 5);
});

test("message idempotency returns the same record", async () => {
  const messages = await runtime();
  const first = await messages.sendText({ sessionId: "s1", to: "6281234567890", text: "one", idempotencyKey: "same-key-0001" });
  const second = await messages.sendText({ sessionId: "s1", to: "6281234567890", text: "two", idempotencyKey: "same-key-0001" });
  assert.equal(second.messageId, first.messageId);
  assert.equal(second.text, "one");
});

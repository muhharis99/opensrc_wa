import { OpenSrcWaError } from "../../core/src/errors";

export interface ChatRecord {
  sessionId: string;
  chatId: string;
  title: string;
  kind: "direct" | "group" | "channel";
  archived: boolean;
  pinned: boolean;
  mutedUntil: string | null;
  unreadCount: number;
  lastMessageAt: string | null;
  updatedAt: string;
}

export class ChatService {
  private readonly records = new Map<string, ChatRecord>();

  public ensure(input: { sessionId: string; chatId: string; title?: string; kind?: ChatRecord["kind"] }): ChatRecord {
    const key = this.key(input.sessionId, input.chatId);
    const existing = this.records.get(key);
    if (existing) return { ...existing };
    const record: ChatRecord = {
      sessionId: input.sessionId,
      chatId: input.chatId,
      title: input.title ?? input.chatId,
      kind: input.kind ?? (input.chatId.endsWith("@g.us") ? "group" : "direct"),
      archived: false,
      pinned: false,
      mutedUntil: null,
      unreadCount: 0,
      lastMessageAt: null,
      updatedAt: new Date().toISOString()
    };
    this.records.set(key, record);
    return { ...record };
  }

  public list(sessionId: string): ChatRecord[] {
    return [...this.records.values()].filter((record) => record.sessionId === sessionId).map((record) => ({ ...record }));
  }

  public get(sessionId: string, chatId: string): ChatRecord {
    const record = this.records.get(this.key(sessionId, chatId));
    if (!record) throw new OpenSrcWaError({ code: "CHAT_NOT_FOUND", category: "VALIDATION_ERROR", message: "Chat tidak ditemukan" });
    return { ...record };
  }

  public update(sessionId: string, chatId: string, patch: { archived?: boolean; pinned?: boolean; mutedUntil?: string | null; unreadCount?: number; title?: string }): ChatRecord {
    const record = this.mutable(sessionId, chatId);
    if (patch.archived !== undefined) record.archived = patch.archived;
    if (patch.pinned !== undefined) record.pinned = patch.pinned;
    if (patch.mutedUntil !== undefined) record.mutedUntil = patch.mutedUntil;
    if (patch.unreadCount !== undefined) record.unreadCount = Math.max(0, patch.unreadCount);
    if (patch.title !== undefined) record.title = patch.title;
    record.updatedAt = new Date().toISOString();
    return { ...record };
  }

  public touch(sessionId: string, chatId: string, incoming: boolean): ChatRecord {
    this.ensure({ sessionId, chatId });
    const record = this.mutable(sessionId, chatId);
    record.lastMessageAt = new Date().toISOString();
    if (incoming) record.unreadCount += 1;
    record.updatedAt = record.lastMessageAt;
    return { ...record };
  }

  public search(sessionId: string, query: string): ChatRecord[] {
    const normalized = query.toLowerCase();
    return this.list(sessionId).filter((record) => record.chatId.toLowerCase().includes(normalized) || record.title.toLowerCase().includes(normalized));
  }

  private mutable(sessionId: string, chatId: string): ChatRecord {
    const record = this.records.get(this.key(sessionId, chatId));
    if (!record) throw new OpenSrcWaError({ code: "CHAT_NOT_FOUND", category: "VALIDATION_ERROR", message: "Chat tidak ditemukan" });
    return record;
  }

  private key(sessionId: string, chatId: string): string { return `${sessionId}:${chatId}`; }
}

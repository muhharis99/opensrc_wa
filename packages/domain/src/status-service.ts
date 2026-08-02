import crypto = require("node:crypto");
import { OpenSrcWaError } from "../../core/src/errors";

export interface StatusRecord {
  statusId: string;
  sessionId: string;
  ownerJid: string;
  type: "text" | "image" | "video" | "audio";
  text: string | null;
  mediaId: string | null;
  backgroundColor: string | null;
  font: number | null;
  expiresAt: string;
  createdAt: string;
  viewers: string[];
  reactions: Array<{ jid: string; emoji: string; timestamp: string }>;
}

export class StatusService {
  private readonly records = new Map<string, StatusRecord>();

  public create(input: { sessionId: string; ownerJid: string; type: StatusRecord["type"]; text?: string; mediaId?: string; backgroundColor?: string; font?: number }): StatusRecord {
    const now = new Date();
    const record: StatusRecord = {
      statusId: crypto.randomUUID(),
      sessionId: input.sessionId,
      ownerJid: input.ownerJid,
      type: input.type,
      text: input.text ?? null,
      mediaId: input.mediaId ?? null,
      backgroundColor: input.backgroundColor ?? null,
      font: input.font ?? null,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now.toISOString(),
      viewers: [],
      reactions: []
    };
    this.records.set(record.statusId, record);
    return cloneStatus(record);
  }

  public list(sessionId: string): StatusRecord[] { return [...this.records.values()].filter((record) => record.sessionId === sessionId && Date.parse(record.expiresAt) > Date.now()).map(cloneStatus); }

  public view(sessionId: string, statusId: string, viewerJid: string): StatusRecord {
    const record = this.mutable(sessionId, statusId);
    if (!record.viewers.includes(viewerJid)) record.viewers.push(viewerJid);
    return cloneStatus(record);
  }

  public react(sessionId: string, statusId: string, jid: string, emoji: string): StatusRecord {
    const record = this.mutable(sessionId, statusId);
    record.reactions = record.reactions.filter((reaction) => reaction.jid !== jid);
    record.reactions.push({ jid, emoji, timestamp: new Date().toISOString() });
    return cloneStatus(record);
  }

  private mutable(sessionId: string, statusId: string): StatusRecord {
    const record = this.records.get(statusId);
    if (!record || record.sessionId !== sessionId) throw new OpenSrcWaError({ code: "STATUS_NOT_FOUND", category: "VALIDATION_ERROR", message: "Status tidak ditemukan" });
    return record;
  }
}
function cloneStatus(record: StatusRecord): StatusRecord { return { ...record, viewers: [...record.viewers], reactions: record.reactions.map((reaction) => ({ ...reaction })) }; }

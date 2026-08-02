import crypto = require("node:crypto");
import { OpenSrcWaError } from "../../core/src/errors";

export interface ChannelUpdate { updateId: string; text: string; mediaId: string | null; createdAt: string; reactions: Record<string, number>; }
export interface ChannelRecord { channelId: string; sessionId: string; name: string; description: string; ownerJid: string; followers: string[]; updates: ChannelUpdate[]; createdAt: string; updatedAt: string; }

export class ChannelService {
  private readonly records = new Map<string, ChannelRecord>();
  public create(input: { sessionId: string; name: string; description?: string; ownerJid: string }): ChannelRecord {
    const now = new Date().toISOString();
    const record: ChannelRecord = { channelId: `${crypto.randomUUID()}@newsletter`, sessionId: input.sessionId, name: input.name, description: input.description ?? "", ownerJid: input.ownerJid, followers: [], updates: [], createdAt: now, updatedAt: now };
    this.records.set(record.channelId, record);
    return cloneChannel(record);
  }
  public list(sessionId: string): ChannelRecord[] { return [...this.records.values()].filter((record) => record.sessionId === sessionId).map(cloneChannel); }
  public follow(sessionId: string, channelId: string, jid: string, follow: boolean): ChannelRecord {
    const record = this.mutable(sessionId, channelId);
    const followers = new Set(record.followers);
    if (follow) followers.add(jid); else followers.delete(jid);
    record.followers = [...followers];
    record.updatedAt = new Date().toISOString();
    return cloneChannel(record);
  }
  public publish(sessionId: string, channelId: string, input: { text: string; mediaId?: string }): ChannelRecord {
    const record = this.mutable(sessionId, channelId);
    record.updates.push({ updateId: crypto.randomUUID(), text: input.text, mediaId: input.mediaId ?? null, createdAt: new Date().toISOString(), reactions: {} });
    record.updatedAt = new Date().toISOString();
    return cloneChannel(record);
  }
  public react(sessionId: string, channelId: string, updateId: string, emoji: string): ChannelRecord {
    const record = this.mutable(sessionId, channelId);
    const update = record.updates.find((candidate) => candidate.updateId === updateId);
    if (!update) throw new OpenSrcWaError({ code: "CHANNEL_UPDATE_NOT_FOUND", category: "VALIDATION_ERROR", message: "Update channel tidak ditemukan" });
    update.reactions[emoji] = (update.reactions[emoji] ?? 0) + 1;
    return cloneChannel(record);
  }
  private mutable(sessionId: string, channelId: string): ChannelRecord {
    const record = this.records.get(channelId);
    if (!record || record.sessionId !== sessionId) throw new OpenSrcWaError({ code: "CHANNEL_NOT_FOUND", category: "VALIDATION_ERROR", message: "Channel tidak ditemukan" });
    return record;
  }
}
function cloneChannel(record: ChannelRecord): ChannelRecord { return { ...record, followers: [...record.followers], updates: record.updates.map((update) => ({ ...update, reactions: { ...update.reactions } })) }; }

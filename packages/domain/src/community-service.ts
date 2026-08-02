import crypto = require("node:crypto");
import { OpenSrcWaError } from "../../core/src/errors";

export interface CommunityRecord { communityId: string; sessionId: string; subject: string; description: string; ownerJid: string; subgroupIds: string[]; createdAt: string; updatedAt: string; }
export class CommunityService {
  private readonly records = new Map<string, CommunityRecord>();
  public create(input: { sessionId: string; subject: string; description?: string; ownerJid: string }): CommunityRecord {
    const now = new Date().toISOString();
    const record: CommunityRecord = { communityId: `${crypto.randomUUID()}@community`, sessionId: input.sessionId, subject: input.subject, description: input.description ?? "", ownerJid: input.ownerJid, subgroupIds: [], createdAt: now, updatedAt: now };
    this.records.set(record.communityId, record);
    return clone(record);
  }
  public list(sessionId: string): CommunityRecord[] { return [...this.records.values()].filter((record) => record.sessionId === sessionId).map(clone); }
  public attach(sessionId: string, communityId: string, groupId: string, attach: boolean): CommunityRecord {
    const record = this.mutable(sessionId, communityId);
    const groups = new Set(record.subgroupIds);
    if (attach) groups.add(groupId); else groups.delete(groupId);
    record.subgroupIds = [...groups];
    record.updatedAt = new Date().toISOString();
    return clone(record);
  }
  private mutable(sessionId: string, communityId: string): CommunityRecord {
    const record = this.records.get(communityId);
    if (!record || record.sessionId !== sessionId) throw new OpenSrcWaError({ code: "COMMUNITY_NOT_FOUND", category: "VALIDATION_ERROR", message: "Komunitas tidak ditemukan" });
    return record;
  }
}
function clone(record: CommunityRecord): CommunityRecord { return { ...record, subgroupIds: [...record.subgroupIds] }; }

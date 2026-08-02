import crypto = require("node:crypto");
import { OpenSrcWaError } from "../../core/src/errors";

export type GroupRole = "member" | "admin" | "superadmin";
export interface GroupParticipant { jid: string; role: GroupRole; joinedAt: string; }
export interface GroupRecord {
  groupId: string;
  sessionId: string;
  subject: string;
  description: string;
  pictureUrl: string | null;
  participants: GroupParticipant[];
  announce: boolean;
  locked: boolean;
  approvalRequired: boolean;
  disappearingSeconds: number | null;
  inviteCode: string;
  createdAt: string;
  updatedAt: string;
}

export class GroupService {
  private readonly records = new Map<string, GroupRecord>();

  public create(input: { sessionId: string; subject: string; participants?: string[] }): GroupRecord {
    const now = new Date().toISOString();
    const groupId = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}@g.us`;
    const participants = [...new Set(input.participants ?? [])].map((jid) => ({ jid, role: "member" as const, joinedAt: now }));
    const record: GroupRecord = {
      groupId,
      sessionId: input.sessionId,
      subject: input.subject,
      description: "",
      pictureUrl: null,
      participants,
      announce: false,
      locked: false,
      approvalRequired: false,
      disappearingSeconds: null,
      inviteCode: crypto.randomBytes(12).toString("base64url"),
      createdAt: now,
      updatedAt: now
    };
    this.records.set(this.key(input.sessionId, groupId), record);
    return cloneGroup(record);
  }

  public list(sessionId: string): GroupRecord[] { return [...this.records.values()].filter((record) => record.sessionId === sessionId).map(cloneGroup); }
  public get(sessionId: string, groupId: string): GroupRecord { return cloneGroup(this.mutable(sessionId, groupId)); }

  public update(sessionId: string, groupId: string, patch: { subject?: string; description?: string; pictureUrl?: string | null; announce?: boolean; locked?: boolean; approvalRequired?: boolean; disappearingSeconds?: number | null }): GroupRecord {
    const record = this.mutable(sessionId, groupId);
    if (patch.subject !== undefined) record.subject = patch.subject;
    if (patch.description !== undefined) record.description = patch.description;
    if (patch.pictureUrl !== undefined) record.pictureUrl = patch.pictureUrl;
    if (patch.announce !== undefined) record.announce = patch.announce;
    if (patch.locked !== undefined) record.locked = patch.locked;
    if (patch.approvalRequired !== undefined) record.approvalRequired = patch.approvalRequired;
    if (patch.disappearingSeconds !== undefined) record.disappearingSeconds = patch.disappearingSeconds;
    record.updatedAt = new Date().toISOString();
    return cloneGroup(record);
  }

  public addParticipants(sessionId: string, groupId: string, jids: string[]): GroupRecord {
    const record = this.mutable(sessionId, groupId);
    const existing = new Set(record.participants.map((item) => item.jid));
    const now = new Date().toISOString();
    for (const jid of jids) if (!existing.has(jid)) record.participants.push({ jid, role: "member", joinedAt: now });
    record.updatedAt = now;
    return cloneGroup(record);
  }

  public removeParticipants(sessionId: string, groupId: string, jids: string[]): GroupRecord {
    const record = this.mutable(sessionId, groupId);
    const remove = new Set(jids);
    record.participants = record.participants.filter((participant) => !remove.has(participant.jid));
    record.updatedAt = new Date().toISOString();
    return cloneGroup(record);
  }

  public setRole(sessionId: string, groupId: string, jids: string[], role: GroupRole): GroupRecord {
    const record = this.mutable(sessionId, groupId);
    const targets = new Set(jids);
    for (const participant of record.participants) if (targets.has(participant.jid)) participant.role = role;
    record.updatedAt = new Date().toISOString();
    return cloneGroup(record);
  }

  public revokeInvite(sessionId: string, groupId: string): GroupRecord {
    const record = this.mutable(sessionId, groupId);
    record.inviteCode = crypto.randomBytes(12).toString("base64url");
    record.updatedAt = new Date().toISOString();
    return cloneGroup(record);
  }

  public joinByInvite(sessionId: string, inviteCode: string, jid: string): GroupRecord {
    const record = [...this.records.values()].find((candidate) => candidate.sessionId === sessionId && candidate.inviteCode === inviteCode);
    if (!record) throw new OpenSrcWaError({ code: "INVITE_NOT_FOUND", category: "VALIDATION_ERROR", message: "Kode undangan tidak valid" });
    return this.addParticipants(sessionId, record.groupId, [jid]);
  }

  public leave(sessionId: string, groupId: string, jid: string): GroupRecord { return this.removeParticipants(sessionId, groupId, [jid]); }

  private mutable(sessionId: string, groupId: string): GroupRecord {
    const record = this.records.get(this.key(sessionId, groupId));
    if (!record) throw new OpenSrcWaError({ code: "GROUP_NOT_FOUND", category: "VALIDATION_ERROR", message: "Grup tidak ditemukan" });
    return record;
  }

  private key(sessionId: string, groupId: string): string { return `${sessionId}:${groupId}`; }
}

function cloneGroup(record: GroupRecord): GroupRecord { return { ...record, participants: record.participants.map((participant) => ({ ...participant })) }; }

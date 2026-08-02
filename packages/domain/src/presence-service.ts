export type PresenceState = "available" | "unavailable" | "composing" | "recording" | "paused";
export interface PresenceRecord { sessionId: string; jid: string; state: PresenceState; lastSeenAt: string; updatedAt: string; }

export class PresenceService {
  private readonly records = new Map<string, PresenceRecord>();
  private readonly subscriptions = new Map<string, Set<string>>();

  public set(sessionId: string, jid: string, state: PresenceState): PresenceRecord {
    const now = new Date().toISOString();
    const record: PresenceRecord = { sessionId, jid, state, lastSeenAt: now, updatedAt: now };
    this.records.set(`${sessionId}:${jid}`, record);
    return { ...record };
  }

  public get(sessionId: string, jid: string): PresenceRecord | null {
    const record = this.records.get(`${sessionId}:${jid}`);
    return record ? { ...record } : null;
  }

  public subscribe(sessionId: string, jid: string): string[] {
    const set = this.subscriptions.get(sessionId) ?? new Set<string>();
    set.add(jid);
    this.subscriptions.set(sessionId, set);
    return [...set];
  }

  public listSubscriptions(sessionId: string): string[] { return [...(this.subscriptions.get(sessionId) ?? [])]; }
}

export interface PrivacySettings {
  sessionId: string;
  lastSeen: "everyone" | "contacts" | "contacts-except" | "nobody";
  online: "everyone" | "same-as-last-seen";
  profilePhoto: "everyone" | "contacts" | "contacts-except" | "nobody";
  about: "everyone" | "contacts" | "contacts-except" | "nobody";
  status: "contacts" | "contacts-except" | "only-share-with";
  readReceipts: boolean;
  groups: "everyone" | "contacts" | "contacts-except";
  silenceUnknownCalls: boolean;
  updatedAt: string;
}
export class PrivacyService {
  private readonly records = new Map<string, PrivacySettings>();
  public get(sessionId: string): PrivacySettings {
    const existing = this.records.get(sessionId);
    if (existing) return { ...existing };
    const created: PrivacySettings = { sessionId, lastSeen: "contacts", online: "same-as-last-seen", profilePhoto: "contacts", about: "contacts", status: "contacts", readReceipts: true, groups: "contacts", silenceUnknownCalls: false, updatedAt: new Date().toISOString() };
    this.records.set(sessionId, created);
    return { ...created };
  }
  public update(sessionId: string, patch: Partial<Omit<PrivacySettings, "sessionId" | "updatedAt">>): PrivacySettings {
    const current = this.get(sessionId);
    const updated: PrivacySettings = { ...current, ...patch, sessionId, updatedAt: new Date().toISOString() };
    this.records.set(sessionId, updated);
    return { ...updated };
  }
}

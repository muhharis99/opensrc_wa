import crypto = require("node:crypto");
import { OpenSrcWaError } from "../../core/src/errors";

export type ConsentStatus = "unknown" | "granted" | "revoked";

export interface ContactRecord {
  contactId: string;
  sessionId: string;
  jid: string;
  phone: string;
  name: string;
  pushName: string;
  about: string;
  profilePictureUrl: string | null;
  registered: boolean;
  blocked: boolean;
  consentStatus: ConsentStatus;
  consentBasis: string | null;
  consentUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export class ContactService {
  private readonly records = new Map<string, ContactRecord>();

  public upsert(input: { sessionId: string; phone: string; name?: string; pushName?: string; about?: string }): ContactRecord {
    validatePhone(input.phone);
    const key = this.key(input.sessionId, input.phone);
    const existing = this.records.get(key);
    const now = new Date().toISOString();
    const record: ContactRecord = existing ? {
      ...existing,
      name: input.name ?? existing.name,
      pushName: input.pushName ?? existing.pushName,
      about: input.about ?? existing.about,
      updatedAt: now
    } : {
      contactId: crypto.randomUUID(),
      sessionId: input.sessionId,
      jid: `${input.phone}@s.whatsapp.net`,
      phone: input.phone,
      name: input.name ?? "",
      pushName: input.pushName ?? "",
      about: input.about ?? "",
      profilePictureUrl: null,
      registered: true,
      blocked: false,
      consentStatus: "unknown",
      consentBasis: null,
      consentUpdatedAt: null,
      createdAt: now,
      updatedAt: now
    };
    this.records.set(key, record);
    return clone(record);
  }

  public list(sessionId: string): ContactRecord[] {
    return [...this.records.values()].filter((record) => record.sessionId === sessionId).map(clone);
  }

  public get(sessionId: string, phoneOrJid: string): ContactRecord {
    const phone = phoneOrJid.replace(/@s\.whatsapp\.net$/, "");
    const record = this.records.get(this.key(sessionId, phone));
    if (!record) throw new OpenSrcWaError({ code: "CONTACT_NOT_FOUND", category: "VALIDATION_ERROR", message: "Kontak tidak ditemukan" });
    return clone(record);
  }

  public remove(sessionId: string, phoneOrJid: string): void {
    const phone = phoneOrJid.replace(/@s\.whatsapp\.net$/, "");
    if (!this.records.delete(this.key(sessionId, phone))) throw new OpenSrcWaError({ code: "CONTACT_NOT_FOUND", category: "VALIDATION_ERROR", message: "Kontak tidak ditemukan" });
  }

  public setProfile(input: { sessionId: string; phone: string; about?: string; profilePictureUrl?: string | null }): ContactRecord {
    const record = this.getMutable(input.sessionId, input.phone);
    if (input.about !== undefined) record.about = input.about;
    if (input.profilePictureUrl !== undefined) record.profilePictureUrl = input.profilePictureUrl;
    record.updatedAt = new Date().toISOString();
    return clone(record);
  }

  public setBlocked(sessionId: string, phone: string, blocked: boolean): ContactRecord {
    const record = this.ensure(sessionId, phone);
    record.blocked = blocked;
    record.updatedAt = new Date().toISOString();
    return clone(record);
  }

  public grantConsent(sessionId: string, phone: string, basis: string): ContactRecord {
    const record = this.ensure(sessionId, phone);
    record.consentStatus = "granted";
    record.consentBasis = basis;
    record.consentUpdatedAt = new Date().toISOString();
    record.updatedAt = record.consentUpdatedAt;
    return clone(record);
  }

  public revokeConsent(sessionId: string, phone: string): ContactRecord {
    const record = this.ensure(sessionId, phone);
    record.consentStatus = "revoked";
    record.consentBasis = null;
    record.consentUpdatedAt = new Date().toISOString();
    record.updatedAt = record.consentUpdatedAt;
    return clone(record);
  }

  public assertCanMessage(sessionId: string, phone: string): void {
    const record = this.records.get(this.key(sessionId, phone));
    if (record?.blocked) throw new OpenSrcWaError({ code: "RECIPIENT_BLOCKED", category: "MESSAGE_ERROR", message: "Penerima diblokir" });
    if (record?.consentStatus === "revoked") throw new OpenSrcWaError({ code: "CONSENT_REVOKED", category: "MESSAGE_ERROR", message: "Persetujuan penerima telah dicabut" });
  }

  public checkRegistration(phone: string): { phone: string; jid: string; registered: boolean; source: "mock" } {
    validatePhone(phone);
    return { phone, jid: `${phone}@s.whatsapp.net`, registered: !phone.endsWith("0000"), source: "mock" };
  }

  private ensure(sessionId: string, phone: string): ContactRecord {
    const key = this.key(sessionId, phone);
    return this.records.get(key) ?? this.createMutable(sessionId, phone);
  }

  private createMutable(sessionId: string, phone: string): ContactRecord {
    const created = this.upsert({ sessionId, phone });
    const record = this.records.get(this.key(sessionId, phone));
    if (!record) throw new Error("Contact creation failed");
    return record;
  }

  private getMutable(sessionId: string, phone: string): ContactRecord {
    const record = this.records.get(this.key(sessionId, phone));
    if (!record) throw new OpenSrcWaError({ code: "CONTACT_NOT_FOUND", category: "VALIDATION_ERROR", message: "Kontak tidak ditemukan" });
    return record;
  }

  private key(sessionId: string, phone: string): string { return `${sessionId}:${phone}`; }
}

function validatePhone(phone: string): void {
  if (!/^\d{8,16}$/.test(phone)) throw new OpenSrcWaError({ code: "INVALID_RECIPIENT", category: "VALIDATION_ERROR", message: "Nomor harus berupa 8-16 digit" });
}

function clone(record: ContactRecord): ContactRecord { return { ...record }; }

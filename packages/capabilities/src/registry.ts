import type { CapabilityDomain, CapabilityRecord, CapabilityStatus } from "./types";

const mockFeatures: Array<[CapabilityDomain, string, string]> = [
  ["session", "session.multi", "Multi-session lifecycle and encrypted persistence"],
  ["session", "session.qr", "QR pairing lifecycle"],
  ["session", "session.pairing-code", "Phone-number pairing-code contract"],
  ["session", "session.reconnect", "Reconnect state and bounded retry"],
  ["messaging", "message.text", "Text messages"],
  ["messaging", "message.reply", "Quoted replies"],
  ["messaging", "message.forward", "Forward messages"],
  ["messaging", "message.reaction", "Message reactions"],
  ["messaging", "message.edit", "Edit messages"],
  ["messaging", "message.delete", "Delete messages"],
  ["messaging", "message.receipts", "Delivery, read, and played receipts"],
  ["messaging", "message.poll", "Poll messages"],
  ["messaging", "message.location", "Location messages"],
  ["messaging", "message.contact", "Contact-card messages"],
  ["media", "media.image", "Image media"],
  ["media", "media.video", "Video media"],
  ["media", "media.audio", "Audio and voice-note media"],
  ["media", "media.document", "Document media"],
  ["media", "media.sticker", "Sticker media"],
  ["chat", "chat.management", "Archive, pin, mute, read, and search"],
  ["chat", "history.mock-sync", "Mock history snapshot export and fixture import"],
  ["contact", "contact.management", "Contacts, profiles, consent, and blocking"],
  ["group", "group.management", "Groups, participants, invites, and settings"],
  ["presence", "presence.update", "Online, typing, recording, and pause state"],
  ["status", "status.updates", "Text/media status, views, and reactions"],
  ["channel", "channel.management", "Channels, follows, updates, and reactions"],
  ["community", "community.management", "Communities and subgroup membership"],
  ["business", "business.profile", "Business profile and catalog products"],
  ["business", "business.labels", "Chat and message labels"],
  ["call", "call.events", "Incoming and outgoing call event lifecycle"],
  ["privacy", "privacy.settings", "Privacy and unknown-call settings"],
  ["gateway", "gateway.rest", "REST API"],
  ["gateway", "gateway.websocket", "Typed WebSocket event stream"],
  ["gateway", "gateway.webhook", "Signed webhook delivery"],
  ["sdk", "sdk.typescript", "Typed TypeScript client"],
  ["plugin", "plugin.hooks", "In-process safe plugin hooks"]
];

const liveBlocked: Array<[CapabilityDomain, string, string]> = [
  ["protocol", "protocol.live-handshake", "Validated WhatsApp live handshake"],
  ["protocol", "protocol.live-pairing", "Validated live QR/pairing code"],
  ["protocol", "protocol.live-messaging", "Validated live message exchange"],
  ["protocol", "protocol.live-media", "Validated live media exchange"],
  ["protocol", "protocol.live-sync", "Validated history and app-state sync"]
];

export class CapabilityRegistry {
  private readonly records = new Map<string, CapabilityRecord>();

  public constructor() {
    for (const [domain, id, title] of mockFeatures) {
      this.register({
        id,
        domain,
        title,
        status: "TESTED_WITH_MOCK",
        runtime: "mock",
        evidence: ["automated mock-runtime tests", "typed API contract"],
        notes: "Feature works in the deterministic mock runtime; no live WhatsApp claim is made."
      });
    }
    for (const [domain, id, title] of liveBlocked) {
      this.register({
        id,
        domain,
        title,
        status: "BLOCKED",
        runtime: "live",
        evidence: ["docs/PROTOCOL_RESEARCH.md"],
        notes: "Blocked until clean-room evidence validates endpoint, schema, handshake, and cryptographic orchestration."
      });
    }
  }

  public register(record: CapabilityRecord): void {
    if (this.records.has(record.id)) throw new Error(`Capability already registered: ${record.id}`);
    this.records.set(record.id, { ...record, evidence: [...record.evidence] });
  }

  public list(filter?: { domain?: CapabilityDomain; status?: CapabilityStatus }): CapabilityRecord[] {
    return [...this.records.values()]
      .filter((record) => !filter?.domain || record.domain === filter.domain)
      .filter((record) => !filter?.status || record.status === filter.status)
      .map((record) => ({ ...record, evidence: [...record.evidence] }))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  public get(id: string): CapabilityRecord | null {
    const record = this.records.get(id);
    return record ? { ...record, evidence: [...record.evidence] } : null;
  }

  public summary(): Record<CapabilityStatus, number> {
    const output: Record<CapabilityStatus, number> = {
      IMPLEMENTED: 0,
      TESTED_WITH_UNIT: 0,
      TESTED_WITH_MOCK: 0,
      TESTED_WITH_FIXTURE: 0,
      LIVE_TESTED: 0,
      EXPERIMENTAL: 0,
      BLOCKED: 0,
      NOT_STARTED: 0
    };
    for (const record of this.records.values()) output[record.status] += 1;
    return output;
  }
}

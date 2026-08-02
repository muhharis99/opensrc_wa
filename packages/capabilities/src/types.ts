export type CapabilityStatus =
  | "IMPLEMENTED"
  | "TESTED_WITH_UNIT"
  | "TESTED_WITH_MOCK"
  | "TESTED_WITH_FIXTURE"
  | "LIVE_TESTED"
  | "EXPERIMENTAL"
  | "BLOCKED"
  | "NOT_STARTED";

export type CapabilityDomain =
  | "session"
  | "messaging"
  | "media"
  | "chat"
  | "contact"
  | "group"
  | "presence"
  | "status"
  | "channel"
  | "community"
  | "business"
  | "call"
  | "privacy"
  | "gateway"
  | "sdk"
  | "plugin"
  | "protocol";

export interface CapabilityRecord {
  id: string;
  domain: CapabilityDomain;
  title: string;
  status: CapabilityStatus;
  runtime: "mock" | "fixture" | "live" | "contract";
  evidence: string[];
  notes: string;
}

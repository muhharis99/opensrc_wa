export type ProviderName = "mock" | "baileys" | "native";

export type ProviderConnectionState =
  | "connecting"
  | "awaiting_pairing"
  | "connected"
  | "disconnected"
  | "logged_out"
  | "conflict"
  | "error";

export interface ProviderMessageKey {
  remoteJid: string;
  id: string;
  fromMe?: boolean;
  participant?: string;
}

export interface ProviderMediaSource {
  base64?: string;
  url?: string;
  filePath?: string;
  mimeType?: string;
  fileName?: string;
}

export type ProviderSendRequest =
  | { kind: "text"; to: string; text: string; mentions?: string[]; quoted?: unknown }
  | { kind: "image" | "video" | "audio" | "document" | "sticker"; to: string; media: ProviderMediaSource; caption?: string; voiceNote?: boolean; gifPlayback?: boolean; quoted?: unknown }
  | { kind: "location"; to: string; latitude: number; longitude: number; name?: string; address?: string; quoted?: unknown }
  | { kind: "contact"; to: string; displayName: string; vcard: string; quoted?: unknown }
  | { kind: "poll"; to: string; question: string; options: string[]; selectableCount?: number; quoted?: unknown }
  | { kind: "reaction"; to: string; key: ProviderMessageKey; emoji: string }
  | { kind: "delete"; to: string; key: ProviderMessageKey }
  | { kind: "edit"; to: string; key: ProviderMessageKey; text: string }
  | { kind: "forward"; to: string; message: unknown };

export interface ProviderSendResult {
  messageId: string;
  remoteJid: string;
  raw?: unknown;
}

export type ProviderEvent =
  | { type: "connection.update"; sessionId: string; state: ProviderConnectionState; reason?: string; retryable?: boolean }
  | { type: "pairing.qr"; sessionId: string; qr: string }
  | { type: "pairing.code"; sessionId: string; code: string; phone: string }
  | { type: "credentials.updated"; sessionId: string }
  | { type: "message.received"; sessionId: string; message: unknown }
  | { type: "message.updated"; sessionId: string; update: unknown }
  | { type: "presence.updated"; sessionId: string; update: unknown }
  | { type: "group.participants.updated"; sessionId: string; update: unknown }
  | { type: "group.updated"; sessionId: string; update: unknown }
  | { type: "contacts.updated"; sessionId: string; update: unknown }
  | { type: "chats.updated"; sessionId: string; update: unknown }
  | { type: "call.updated"; sessionId: string; update: unknown }
  | { type: "history.synced"; sessionId: string; update: unknown }
  | { type: "provider.error"; sessionId: string; operation: string; error: unknown };

export type ProviderEventListener = (event: ProviderEvent) => void | Promise<void>;

export interface ProviderConnectOptions {
  phone?: string;
  syncFullHistory?: boolean;
}

export interface ProviderGroupCreateInput {
  subject: string;
  participants: string[];
}

export interface WhatsAppProvider {
  readonly name: ProviderName;
  readonly sessionId: string;
  connect(options?: ProviderConnectOptions): Promise<void>;
  requestPairingCode(phone: string): Promise<string>;
  disconnect(): Promise<void>;
  logout(): Promise<void>;
  send(request: ProviderSendRequest): Promise<ProviderSendResult>;
  downloadMedia(message: unknown): Promise<Uint8Array>;
  getContacts(): Promise<unknown[]>;
  getChats(): Promise<unknown[]>;
  checkNumbers(numbers: string[]): Promise<unknown[]>;
  setPresence(state: "available" | "unavailable" | "composing" | "recording" | "paused", jid?: string): Promise<void>;
  createGroup(input: ProviderGroupCreateInput): Promise<unknown>;
  updateGroupParticipants(groupJid: string, participants: string[], action: "add" | "remove" | "promote" | "demote"): Promise<unknown>;
  updateGroupSubject(groupJid: string, subject: string): Promise<void>;
  updateGroupDescription(groupJid: string, description: string): Promise<void>;
  updateGroupSetting(groupJid: string, setting: "announcement" | "not_announcement" | "locked" | "unlocked"): Promise<void>;
  getGroupInviteCode(groupJid: string): Promise<string>;
  revokeGroupInvite(groupJid: string): Promise<string>;
  acceptGroupInvite(code: string): Promise<string>;
  blockContact(jid: string, action: "block" | "unblock"): Promise<void>;
  updateProfileName(name: string): Promise<void>;
  updateProfileStatus(status: string): Promise<void>;
  updateProfilePicture(jid: string, image: Uint8Array): Promise<void>;
  onEvent(listener: ProviderEventListener): () => void;
}

export interface ProviderFactory {
  create(sessionId: string): WhatsAppProvider;
}

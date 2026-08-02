import path = require("node:path");
import type {
  ProviderConnectOptions,
  ProviderEvent,
  ProviderEventListener,
  ProviderGroupCreateInput,
  ProviderSendRequest,
  ProviderSendResult,
  WhatsAppProvider
} from "../../provider-contract/src/types";
import type { BaileysModule, BaileysModuleLoader } from "./module-loader";
import { loadBaileysModule } from "./module-loader";

export interface BaileysProviderOptions {
  sessionId: string;
  authRootDir: string;
  reconnectBaseDelayMs?: number;
  reconnectMaxDelayMs?: number;
  moduleLoader?: BaileysModuleLoader;
}

export class BaileysProvider implements WhatsAppProvider {
  public readonly name = "baileys" as const;
  public readonly sessionId: string;
  private readonly listeners = new Set<ProviderEventListener>();
  private readonly authDirectory: string;
  private readonly reconnectBaseDelayMs: number;
  private readonly reconnectMaxDelayMs: number;
  private readonly moduleLoader: BaileysModuleLoader;
  private baileys: BaileysModule | null = null;
  private socket: any = null;
  private saveCreds: (() => Promise<void>) | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;
  private connectOptions: ProviderConnectOptions = {};
  private readonly contacts = new Map<string, unknown>();
  private readonly chats = new Map<string, unknown>();

  public constructor(options: BaileysProviderOptions) {
    this.sessionId = options.sessionId;
    this.authDirectory = path.resolve(options.authRootDir, safeSegment(options.sessionId));
    this.reconnectBaseDelayMs = options.reconnectBaseDelayMs ?? 1_000;
    this.reconnectMaxDelayMs = options.reconnectMaxDelayMs ?? 30_000;
    this.moduleLoader = options.moduleLoader ?? loadBaileysModule;
  }

  public async connect(options: ProviderConnectOptions = {}): Promise<void> {
    this.connectOptions = { ...options };
    this.intentionallyClosed = false;
    this.clearReconnectTimer();
    await this.emit({ type: "connection.update", sessionId: this.sessionId, state: "connecting" });

    const baileys = await this.getBaileys();
    const { state, saveCreds } = await baileys.useMultiFileAuthState(this.authDirectory);
    this.saveCreds = saveCreds;
    const makeWASocket = baileys.default ?? baileys.makeWASocket;
    if (typeof makeWASocket !== "function") throw new Error("Baileys module does not expose makeWASocket");

    const browser = baileys.Browsers?.ubuntu?.("opensrc_wa") ?? ["opensrc_wa", "Chrome", "1.0.0"];
    const versionResult = typeof baileys.fetchLatestBaileysVersion === "function"
      ? await baileys.fetchLatestBaileysVersion().catch(() => null)
      : null;

    const socket = makeWASocket({
      auth: state,
      browser,
      logger: silentLogger(),
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      syncFullHistory: options.syncFullHistory ?? false,
      ...(versionResult?.version ? { version: versionResult.version } : {})
    });
    this.socket = socket;
    this.bindEvents(socket, baileys);

    if (options.phone && !socket.authState?.creds?.registered) {
      await this.requestPairingCode(options.phone);
    }
  }

  public async requestPairingCode(phone: string): Promise<string> {
    const normalized = normalizePhone(phone);
    const socket = this.requireSocket();
    if (typeof socket.requestPairingCode !== "function") throw new Error("Pairing code is not supported by the installed provider version");
    const code = await socket.requestPairingCode(normalized);
    await this.emit({ type: "pairing.code", sessionId: this.sessionId, code, phone: normalized });
    return code;
  }

  public async disconnect(): Promise<void> {
    this.intentionallyClosed = true;
    this.clearReconnectTimer();
    const socket = this.socket;
    this.socket = null;
    if (socket?.ws?.close) socket.ws.close();
    else if (socket?.end) socket.end(new Error("opensrc_wa provider disconnected"));
    await this.emit({ type: "connection.update", sessionId: this.sessionId, state: "disconnected", reason: "manual_disconnect", retryable: false });
  }

  public async logout(): Promise<void> {
    this.intentionallyClosed = true;
    this.clearReconnectTimer();
    const socket = this.requireSocket();
    if (typeof socket.logout === "function") await socket.logout();
    this.socket = null;
    await this.emit({ type: "connection.update", sessionId: this.sessionId, state: "logged_out", reason: "logout", retryable: false });
  }

  public async send(request: ProviderSendRequest): Promise<ProviderSendResult> {
    const socket = this.requireSocket();
    const content = await this.toBaileysContent(request);
    const options = "quoted" in request && request.quoted ? { quoted: request.quoted } : undefined;
    const result = await socket.sendMessage(request.to, content, options);
    const messageId = result?.key?.id;
    const remoteJid = result?.key?.remoteJid ?? request.to;
    if (!messageId) throw new Error("Provider did not return a message id");
    return { messageId, remoteJid, raw: result };
  }

  public async downloadMedia(message: unknown): Promise<Uint8Array> {
    const baileys = await this.getBaileys();
    if (typeof baileys.downloadMediaMessage !== "function") throw new Error("downloadMediaMessage is unavailable");
    const data = await baileys.downloadMediaMessage(message, "buffer", {}, { logger: silentLogger(), reuploadRequest: this.requireSocket().updateMediaMessage });
    return new Uint8Array(data);
  }

  public async getContacts(): Promise<unknown[]> { return [...this.contacts.values()]; }
  public async getChats(): Promise<unknown[]> { return [...this.chats.values()]; }

  public async checkNumbers(numbers: string[]): Promise<unknown[]> {
    const socket = this.requireSocket();
    return socket.onWhatsApp(...numbers.map(normalizePhone));
  }

  public async setPresence(state: "available" | "unavailable" | "composing" | "recording" | "paused", jid?: string): Promise<void> {
    await this.requireSocket().sendPresenceUpdate(state, jid);
  }

  public async createGroup(input: ProviderGroupCreateInput): Promise<unknown> {
    return this.requireSocket().groupCreate(input.subject, input.participants);
  }

  public async updateGroupParticipants(groupJid: string, participants: string[], action: "add" | "remove" | "promote" | "demote"): Promise<unknown> {
    return this.requireSocket().groupParticipantsUpdate(groupJid, participants, action);
  }

  public async updateGroupSubject(groupJid: string, subject: string): Promise<void> {
    await this.requireSocket().groupUpdateSubject(groupJid, subject);
  }

  public async updateGroupDescription(groupJid: string, description: string): Promise<void> {
    await this.requireSocket().groupUpdateDescription(groupJid, description);
  }

  public async updateGroupSetting(groupJid: string, setting: "announcement" | "not_announcement" | "locked" | "unlocked"): Promise<void> {
    await this.requireSocket().groupSettingUpdate(groupJid, setting);
  }

  public async getGroupInviteCode(groupJid: string): Promise<string> {
    return this.requireSocket().groupInviteCode(groupJid);
  }

  public async revokeGroupInvite(groupJid: string): Promise<string> {
    return this.requireSocket().groupRevokeInvite(groupJid);
  }

  public async acceptGroupInvite(code: string): Promise<string> {
    return this.requireSocket().groupAcceptInvite(code);
  }

  public async blockContact(jid: string, action: "block" | "unblock"): Promise<void> {
    await this.requireSocket().updateBlockStatus(jid, action);
  }

  public async updateProfileName(name: string): Promise<void> {
    await this.requireSocket().updateProfileName(name);
  }

  public async updateProfileStatus(status: string): Promise<void> {
    await this.requireSocket().updateProfileStatus(status);
  }

  public async updateProfilePicture(jid: string, image: Uint8Array): Promise<void> {
    await this.requireSocket().updateProfilePicture(jid, image);
  }

  public onEvent(listener: ProviderEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private bindEvents(socket: any, baileys: BaileysModule): void {
    socket.ev.on("creds.update", async () => {
      try {
        await this.saveCreds?.();
        await this.emit({ type: "credentials.updated", sessionId: this.sessionId });
      } catch (error) {
        await this.emit({ type: "provider.error", sessionId: this.sessionId, operation: "creds.update", error });
      }
    });

    socket.ev.on("connection.update", async (update: any) => {
      if (update.qr) {
        await this.emit({ type: "pairing.qr", sessionId: this.sessionId, qr: update.qr });
        await this.emit({ type: "connection.update", sessionId: this.sessionId, state: "awaiting_pairing" });
      }
      if (update.connection === "open") {
        this.reconnectAttempts = 0;
        await this.emit({ type: "connection.update", sessionId: this.sessionId, state: "connected" });
      }
      if (update.connection === "close") {
        const statusCode = disconnectStatusCode(update.lastDisconnect?.error);
        const loggedOut = statusCode === baileys.DisconnectReason?.loggedOut;
        const conflict = statusCode === baileys.DisconnectReason?.connectionReplaced;
        if (loggedOut) {
          await this.emit({ type: "connection.update", sessionId: this.sessionId, state: "logged_out", reason: String(statusCode), retryable: false });
          return;
        }
        if (conflict) {
          await this.emit({ type: "connection.update", sessionId: this.sessionId, state: "conflict", reason: String(statusCode), retryable: false });
          return;
        }
        await this.emit({ type: "connection.update", sessionId: this.sessionId, state: "disconnected", reason: String(statusCode ?? "unknown"), retryable: !this.intentionallyClosed });
        if (!this.intentionallyClosed) this.scheduleReconnect();
      }
    });

    socket.ev.on("messages.upsert", async (update: any) => {
      for (const message of update.messages ?? []) await this.emit({ type: "message.received", sessionId: this.sessionId, message });
    });
    socket.ev.on("messages.update", async (update: unknown) => this.emit({ type: "message.updated", sessionId: this.sessionId, update }));
    socket.ev.on("presence.update", async (update: unknown) => this.emit({ type: "presence.updated", sessionId: this.sessionId, update }));
    socket.ev.on("group-participants.update", async (update: unknown) => this.emit({ type: "group.participants.updated", sessionId: this.sessionId, update }));
    socket.ev.on("groups.update", async (update: unknown) => this.emit({ type: "group.updated", sessionId: this.sessionId, update }));
    socket.ev.on("contacts.upsert", async (items: any[]) => {
      for (const item of items ?? []) if (item?.id) this.contacts.set(item.id, item);
      await this.emit({ type: "contacts.updated", sessionId: this.sessionId, update: items });
    });
    socket.ev.on("contacts.update", async (items: any[]) => {
      for (const item of items ?? []) if (item?.id) this.contacts.set(item.id, { ...(this.contacts.get(item.id) as object ?? {}), ...item });
      await this.emit({ type: "contacts.updated", sessionId: this.sessionId, update: items });
    });
    socket.ev.on("chats.upsert", async (items: any[]) => {
      for (const item of items ?? []) if (item?.id) this.chats.set(item.id, item);
      await this.emit({ type: "chats.updated", sessionId: this.sessionId, update: items });
    });
    socket.ev.on("chats.update", async (items: any[]) => {
      for (const item of items ?? []) if (item?.id) this.chats.set(item.id, { ...(this.chats.get(item.id) as object ?? {}), ...item });
      await this.emit({ type: "chats.updated", sessionId: this.sessionId, update: items });
    });
    socket.ev.on("call", async (update: unknown) => this.emit({ type: "call.updated", sessionId: this.sessionId, update }));
    socket.ev.on("messaging-history.set", async (update: unknown) => this.emit({ type: "history.synced", sessionId: this.sessionId, update }));
  }

  private async toBaileysContent(request: ProviderSendRequest): Promise<Record<string, unknown>> {
    switch (request.kind) {
      case "text": return { text: request.text, ...(request.mentions?.length ? { mentions: request.mentions } : {}) };
      case "image": return { image: mediaValue(request.media), caption: request.caption ?? "" };
      case "video": return { video: mediaValue(request.media), caption: request.caption ?? "", gifPlayback: request.gifPlayback ?? false };
      case "audio": return { audio: mediaValue(request.media), mimetype: request.media.mimeType ?? "audio/ogg; codecs=opus", ptt: request.voiceNote ?? false };
      case "document": return { document: mediaValue(request.media), mimetype: request.media.mimeType ?? "application/octet-stream", fileName: request.media.fileName ?? "document" };
      case "sticker": return { sticker: mediaValue(request.media) };
      case "location": return { location: { degreesLatitude: request.latitude, degreesLongitude: request.longitude, name: request.name, address: request.address } };
      case "contact": return { contacts: { displayName: request.displayName, contacts: [{ vcard: request.vcard }] } };
      case "poll": return { poll: { name: request.question, values: request.options, selectableCount: request.selectableCount ?? 1 } };
      case "reaction": return { react: { text: request.emoji, key: request.key } };
      case "delete": return { delete: request.key };
      case "edit": return { text: request.text, edit: request.key };
      case "forward": return { forward: request.message };
      default: return assertNever(request);
    }
  }

  private async getBaileys(): Promise<BaileysModule> {
    if (!this.baileys) this.baileys = await this.moduleLoader();
    return this.baileys;
  }

  private requireSocket(): any {
    if (!this.socket) throw new Error(`Provider session '${this.sessionId}' is not connected`);
    return this.socket;
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    const delay = Math.min(this.reconnectMaxDelayMs, this.reconnectBaseDelayMs * 2 ** this.reconnectAttempts);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect(this.connectOptions).catch((error) => this.emit({ type: "provider.error", sessionId: this.sessionId, operation: "reconnect", error }));
    }, delay);
    (this.reconnectTimer as unknown as { unref?: () => void }).unref?.();
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private async emit(event: ProviderEvent): Promise<void> {
    for (const listener of [...this.listeners]) await listener(event);
  }
}

function mediaValue(source: { base64?: string; url?: string; filePath?: string }): unknown {
  if (source.base64) return Buffer.from(source.base64, "base64");
  if (source.url) return { url: source.url };
  if (source.filePath) return { url: source.filePath };
  throw new Error("Media source requires base64, url, or filePath");
}

function normalizePhone(phone: string): string {
  const normalized = phone.replace(/\D/g, "");
  if (!/^\d{8,16}$/.test(normalized)) throw new Error("Phone number must contain 8-16 digits including country code");
  return normalized;
}

function safeSegment(value: string): string {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(value)) throw new Error("Invalid session id");
  return value;
}

function disconnectStatusCode(error: any): number | undefined {
  return error?.output?.statusCode ?? error?.data?.statusCode ?? error?.statusCode;
}

function silentLogger(): any {
  const logger: any = {};
  for (const level of ["trace", "debug", "info", "warn", "error", "fatal"]) logger[level] = () => undefined;
  logger.child = () => logger;
  return logger;
}

function assertNever(value: never): never {
  throw new Error(`Unsupported provider request: ${JSON.stringify(value)}`);
}

import http = require("node:http");
import crypto = require("node:crypto");
import { ApiKeyAuthenticator } from "../../gateway/src/api-key-auth";
import { FixedWindowRateLimiter } from "../../gateway/src/rate-limiter";
import { ProviderManager } from "../../../packages/provider-contract/src/provider-manager";
import { PacedOutboundQueue } from "../../../packages/provider-contract/src/paced-outbound-queue";
import type {
  ProviderButton,
  ProviderConnectionState,
  ProviderListSection,
  ProviderSendRequest
} from "../../../packages/provider-contract/src/types";
import { BaileysProviderFactory } from "../../../packages/provider-baileys/src/factory";
import { SqliteSessionLeaseLock } from "../../../packages/provider-baileys/src/sqlite-lease-lock";
import { NativeProvider } from "../../../packages/provider-native/src/native-provider";
import { QrService } from "../../../packages/qr/src/qr-service";
import { LocalObjectStore } from "../../../packages/object-store/src/local-object-store";
import { WebhookService } from "../../../packages/webhook/src/webhook-service";
import { liveDashboardHtml } from "./dashboard";
import type { LiveGatewayConfig } from "./config";

interface SessionView {
  sessionId: string;
  state: ProviderConnectionState;
  qrPayload: string | null;
  qrPng: Uint8Array | null;
  qrBase64: string | null;
  qrDataUrl: string | null;
  pairingCode: string | null;
  phone: string | null;
  updatedAt: string;
  lastError: string | null;
}

export interface LiveGatewayRuntime {
  server: any;
  providers: ProviderManager;
  close(): Promise<void>;
}

export function createLiveGateway(config: LiveGatewayConfig): LiveGatewayRuntime {
  const queue = new PacedOutboundQueue({
    sessionIntervalMs: config.outboundSessionIntervalMs,
    chatIntervalMs: config.outboundChatIntervalMs,
    maxPending: config.outboundMaxPending
  });
  const leaseLock = new SqliteSessionLeaseLock(config.leaseDatabasePath);
  const providers = new ProviderManager(new BaileysProviderFactory({
    authRootDir: config.authRootDir,
    authStore: config.authStore,
    authDatabasePath: config.authDatabasePath,
    sessionLeaseLock: leaseLock,
    sessionLeaseTtlMs: config.leaseTtlMs
  }), { outboundQueue: queue });
  const sessions = new Map<string, SessionView>();
  const authenticator = new ApiKeyAuthenticator(config.apiKeyHash);
  const limiter = new FixedWindowRateLimiter(config.rateLimitPerMinute, 60_000);
  const webhooks = new WebhookService(config.webhookTimeoutMs, config.webhookMaxRetries);
  const qrService = new QrService();
  const objectStore = new LocalObjectStore(config.objectStoreDir);
  const nativeProvider = new NativeProvider("native-research-status");
  if (config.webhookUrl && config.webhookSecret) webhooks.create({ url: config.webhookUrl, secret: config.webhookSecret, events: ["*"] });

  providers.onEvent(async (event) => {
    const current = sessions.get(event.sessionId) ?? freshSession(event.sessionId);
    current.updatedAt = new Date().toISOString();
    if (event.type === "connection.update") {
      current.state = event.state;
      current.lastError = event.state === "error" ? event.reason ?? "provider error" : null;
      if (event.state === "connected") clearQr(current);
    } else if (event.type === "pairing.qr") {
      current.state = "awaiting_pairing";
      current.qrPayload = event.qr;
      try {
        const rendered = await qrService.render(event.qr);
        current.qrPng = rendered.png;
        current.qrBase64 = rendered.base64;
        current.qrDataUrl = rendered.dataUrl;
      } catch (error) {
        current.lastError = `QR_RENDER_FAILED: ${errorMessage(error)}`;
      }
    } else if (event.type === "pairing.code") {
      current.state = "awaiting_pairing";
      current.pairingCode = event.code;
      current.phone = event.phone;
    } else if (event.type === "provider.error") {
      current.lastError = errorMessage(event.error);
    }
    sessions.set(event.sessionId, current);
    await webhooks.publish(event.type, event);
  });

  const server = http.createServer(async (request: any, response: any) => {
    const requestId = crypto.randomUUID();
    response.setHeader("X-Request-Id", requestId);
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "no-referrer");
    try {
      const method = request.method ?? "GET";
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
      if (method === "GET" && url.pathname === "/health") return success(response, 200, requestId, { status: "ok", provider: "baileys" });
      if (method === "GET" && url.pathname === "/ready") return success(response, 200, requestId, { ready: true, provider: "baileys", unofficial: true, auth_store: config.authStore });
      if (method === "GET" && url.pathname === "/dashboard") {
        response.statusCode = 200;
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'");
        return response.end(liveDashboardHtml);
      }

      const apiKey = header(request.headers, "x-api-key") ?? url.searchParams.get("api_key") ?? undefined;
      if (!authenticator.verify(apiKey)) return failure(response, 401, requestId, "UNAUTHORIZED", "API key tidak valid");
      const identity = crypto.createHash("sha256").update(apiKey ?? "").digest("hex").slice(0, 16);
      const rate = limiter.consume(`${identity}:${request.socket.remoteAddress ?? "unknown"}`);
      response.setHeader("X-RateLimit-Limit", config.rateLimitPerMinute);
      response.setHeader("X-RateLimit-Remaining", rate.remaining);
      response.setHeader("X-RateLimit-Reset", Math.ceil(rate.resetAt / 1000));
      if (!rate.allowed) return failure(response, 429, requestId, "RATE_LIMITED", "Batas request terlampaui");

      const segments = url.pathname.split("/").filter(Boolean);
      const body = async (): Promise<Record<string, unknown>> => readJson(request, config.maxBodyBytes);

      if (method === "GET" && url.pathname === "/api/v1/live/sessions") {
        return success(response, 200, requestId, {
          sessions: [...sessions.values()].map(sessionResponse),
          queue: providers.queueStats()
        });
      }
      if (method === "GET" && url.pathname === "/api/v1/live/native/status") {
        return success(response, 200, requestId, nativeProvider.status());
      }
      if (method === "GET" && url.pathname === "/api/v1/live/queue") {
        return success(response, 200, requestId, providers.queueStats());
      }
      if (segments[0] === "api" && segments[1] === "v1" && segments[2] === "live" && segments[3] === "objects" && segments[4] && method === "GET") {
        const stored = await objectStore.get(decodeURIComponent(segments[4]));
        response.statusCode = 200;
        response.setHeader("Content-Type", stored.metadata.contentType);
        response.setHeader("Content-Length", stored.metadata.size);
        response.setHeader("Content-Disposition", `attachment; filename="${safeFileName(stored.metadata.fileName ?? stored.metadata.objectId)}"`);
        for await (const chunk of stored.stream) {
          if (!response.write(Buffer.from(chunk))) await waitForDrain(response);
        }
        return response.end();
      }

      if (segments[0] === "api" && segments[1] === "v1" && segments[2] === "live" && segments[3] === "sessions" && segments[4]) {
        const sessionId = validSessionId(decodeURIComponent(segments[4]));
        const action = segments[5];
        if (!action && method === "GET") return success(response, 200, requestId, sessionResponse(sessions.get(sessionId) ?? freshSession(sessionId)));
        if (action === "qr" && method === "GET") {
          const view = requireSessionQr(sessions, sessionId);
          return success(response, 200, requestId, {
            session_id: sessionId,
            payload: view.qrPayload,
            base64: view.qrBase64,
            data_url: view.qrDataUrl
          });
        }
        if (action === "qr.png" && method === "GET") {
          const view = requireSessionQr(sessions, sessionId);
          response.statusCode = 200;
          response.setHeader("Content-Type", "image/png");
          response.setHeader("Cache-Control", "no-store, private");
          return response.end(Buffer.from(view.qrPng as Uint8Array));
        }
        if (action === "connect" && method === "POST") {
          const input = await body();
          const phone = optionalString(input.phone);
          const view = sessions.get(sessionId) ?? freshSession(sessionId);
          view.state = "connecting";
          view.phone = phone;
          view.updatedAt = new Date().toISOString();
          view.lastError = null;
          sessions.set(sessionId, view);
          await providers.connect(sessionId, { ...(phone ? { phone } : {}), syncFullHistory: input.sync_full_history === true });
          return success(response, 202, requestId, sessionResponse(view));
        }
        if (action === "pairing-code" && method === "POST") {
          const input = await body();
          const phone = requiredString(input.phone, "phone");
          const code = await providers.requestPairingCode(sessionId, phone);
          return success(response, 200, requestId, { session_id: sessionId, phone, pairing_code: code });
        }
        if (action === "disconnect" && method === "POST") {
          await providers.disconnect(sessionId);
          return success(response, 200, requestId, sessionResponse(sessions.get(sessionId) ?? freshSession(sessionId)));
        }
        if (action === "logout" && method === "POST") {
          await providers.logout(sessionId);
          return success(response, 200, requestId, sessionResponse(sessions.get(sessionId) ?? freshSession(sessionId)));
        }
        if (action === "messages" && method === "POST") {
          const input = await body();
          return success(response, 202, requestId, await providers.send(sessionId, validateSendRequest(input)));
        }
        if (action === "media" && segments[6] === "download" && method === "POST") {
          const input = await body();
          const provider = providers.get(sessionId);
          if (input.storage === "object") {
            const objectId = `media_${crypto.randomUUID().replaceAll("-", "")}`;
            const metadata = await objectStore.put({
              objectId,
              contentType: optionalString(input.content_type) ?? "application/octet-stream",
              ...(optionalString(input.file_name) ? { fileName: optionalString(input.file_name) as string } : {}),
              stream: await provider.downloadMediaStream(input.message)
            });
            return success(response, 201, requestId, {
              ...metadata,
              download_path: `/api/v1/live/objects/${metadata.objectId}`
            });
          }
          const bytes = await provider.downloadMedia(input.message);
          return success(response, 200, requestId, { base64: Buffer.from(bytes).toString("base64"), size: bytes.byteLength });
        }
        if (action === "contacts" && method === "GET") return success(response, 200, requestId, await providers.get(sessionId).getContacts());
        if (action === "chats" && method === "GET") return success(response, 200, requestId, await providers.get(sessionId).getChats());
        if (action === "numbers" && segments[6] === "check" && method === "POST") {
          const input = await body();
          if (!Array.isArray(input.numbers)) throw new Error("numbers wajib berupa array");
          return success(response, 200, requestId, await providers.get(sessionId).checkNumbers(input.numbers.map(String)));
        }
        if (action === "broadcasts" && segments[6] && method === "GET") {
          return success(response, 200, requestId, await providers.get(sessionId).getBroadcastListInfo(decodeURIComponent(segments[6])));
        }
        if (action === "presence" && method === "POST") {
          const input = await body();
          const state = requiredString(input.state, "state") as "available" | "unavailable" | "composing" | "recording" | "paused";
          if (!["available", "unavailable", "composing", "recording", "paused"].includes(state)) throw new Error("state presence tidak valid");
          const jid = optionalString(input.jid);
          await providers.get(sessionId).setPresence(state, jid ?? undefined);
          return success(response, 200, requestId, { updated: true });
        }
        if (action === "groups" && method === "POST") {
          const input = await body();
          const operation = requiredString(input.operation, "operation");
          return success(response, 200, requestId, await groupOperation(providers, sessionId, operation, input));
        }
        if (action === "contacts" && segments[6] === "block" && method === "POST") {
          const input = await body();
          const actionValue = requiredString(input.action, "action") as "block" | "unblock";
          if (actionValue !== "block" && actionValue !== "unblock") throw new Error("action harus block atau unblock");
          await providers.get(sessionId).blockContact(requiredString(input.jid, "jid"), actionValue);
          return success(response, 200, requestId, { updated: true });
        }
        if (action === "profile" && method === "POST") {
          const input = await body();
          const operation = requiredString(input.operation, "operation");
          const provider = providers.get(sessionId);
          if (operation === "name") await provider.updateProfileName(requiredString(input.value, "value"));
          else if (operation === "status") await provider.updateProfileStatus(requiredString(input.value, "value"));
          else if (operation === "picture") await provider.updateProfilePicture(requiredString(input.jid, "jid"), Buffer.from(requiredString(input.base64, "base64"), "base64"));
          else throw new Error("operation profile tidak didukung");
          return success(response, 200, requestId, { updated: true });
        }
      }

      if (method === "GET" && url.pathname === "/api/v1/live/webhooks/history") return success(response, 200, requestId, webhooks.history());
      return failure(response, 404, requestId, "NOT_FOUND", "Endpoint tidak ditemukan");
    } catch (error) {
      const message = errorMessage(error);
      return failure(response, statusFor(message), requestId, errorCode(message), message);
    }
  });

  return {
    server,
    providers,
    close: async () => {
      await providers.closeAll();
      await new Promise<void>((resolve, reject) => server.close((error?: Error) => error ? reject(error) : resolve()));
    }
  };
}

async function groupOperation(providers: ProviderManager, sessionId: string, operation: string, input: Record<string, unknown>): Promise<unknown> {
  const provider = providers.get(sessionId);
  if (operation === "create") {
    if (!Array.isArray(input.participants)) throw new Error("participants wajib berupa array");
    return provider.createGroup({ subject: requiredString(input.subject, "subject"), participants: input.participants.map(String) });
  }
  if (operation === "participants") {
    if (!Array.isArray(input.participants)) throw new Error("participants wajib berupa array");
    const action = requiredString(input.action, "action") as "add" | "remove" | "promote" | "demote";
    if (!["add", "remove", "promote", "demote"].includes(action)) throw new Error("action participant tidak valid");
    return provider.updateGroupParticipants(requiredString(input.group_jid, "group_jid"), input.participants.map(String), action);
  }
  if (operation === "subject") {
    await provider.updateGroupSubject(requiredString(input.group_jid, "group_jid"), requiredString(input.value, "value"));
    return { updated: true };
  }
  if (operation === "description") {
    await provider.updateGroupDescription(requiredString(input.group_jid, "group_jid"), requiredString(input.value, "value"));
    return { updated: true };
  }
  if (operation === "setting") {
    const setting = requiredString(input.setting, "setting") as "announcement" | "not_announcement" | "locked" | "unlocked";
    await provider.updateGroupSetting(requiredString(input.group_jid, "group_jid"), setting);
    return { updated: true };
  }
  if (operation === "invite") return { code: await provider.getGroupInviteCode(requiredString(input.group_jid, "group_jid")) };
  if (operation === "revoke-invite") return { code: await provider.revokeGroupInvite(requiredString(input.group_jid, "group_jid")) };
  if (operation === "accept-invite") return { group_jid: await provider.acceptGroupInvite(requiredString(input.code, "code")) };
  throw new Error("operation group tidak didukung");
}

function validateSendRequest(input: Record<string, unknown>): ProviderSendRequest {
  const kind = requiredString(input.kind, "kind") as ProviderSendRequest["kind"];
  const to = requiredString(input.to, "to");
  if (kind === "text") return { kind, to, text: requiredString(input.text, "text"), ...(Array.isArray(input.mentions) ? { mentions: input.mentions.map(String) } : {}), ...(input.quoted ? { quoted: input.quoted } : {}) };
  if (["image", "video", "audio", "document", "sticker"].includes(kind)) {
    const media = requiredRecord(input.media, "media");
    return { kind: kind as "image" | "video" | "audio" | "document" | "sticker", to, media: media as any, ...(optionalString(input.caption) ? { caption: optionalString(input.caption) as string } : {}), voiceNote: input.voice_note === true, gifPlayback: input.gif_playback === true, ...(input.quoted ? { quoted: input.quoted } : {}) };
  }
  if (kind === "location") return { kind, to, latitude: requiredNumber(input.latitude, "latitude"), longitude: requiredNumber(input.longitude, "longitude"), ...(optionalString(input.name) ? { name: optionalString(input.name) as string } : {}), ...(optionalString(input.address) ? { address: optionalString(input.address) as string } : {}) };
  if (kind === "contact") return { kind, to, displayName: requiredString(input.display_name, "display_name"), vcard: requiredString(input.vcard, "vcard") };
  if (kind === "poll") {
    if (!Array.isArray(input.options)) throw new Error("options wajib berupa array");
    return { kind, to, question: requiredString(input.question, "question"), options: input.options.map(String), ...(typeof input.selectable_count === "number" ? { selectableCount: input.selectable_count } : {}) };
  }
  if (kind === "buttons") {
    if (!Array.isArray(input.buttons) || input.buttons.length < 1 || input.buttons.length > 3) throw new Error("buttons wajib berisi 1-3 tombol");
    const buttons: ProviderButton[] = input.buttons.map((value, index) => {
      const button = requiredRecord(value, `buttons.${index}`);
      return { id: requiredString(button.id, `buttons.${index}.id`), text: requiredString(button.text, `buttons.${index}.text`) };
    });
    return { kind, to, text: requiredString(input.text, "text"), buttons, ...(optionalString(input.footer) ? { footer: optionalString(input.footer) as string } : {}), ...(input.quoted ? { quoted: input.quoted } : {}) };
  }
  if (kind === "list") {
    if (!Array.isArray(input.sections) || input.sections.length < 1 || input.sections.length > 10) throw new Error("sections wajib berisi 1-10 bagian");
    let rowCount = 0;
    const sections: ProviderListSection[] = input.sections.map((value, sectionIndex) => {
      const section = requiredRecord(value, `sections.${sectionIndex}`);
      if (!Array.isArray(section.rows) || section.rows.length < 1) throw new Error(`sections.${sectionIndex}.rows wajib diisi`);
      rowCount += section.rows.length;
      return {
        ...(optionalString(section.title) ? { title: optionalString(section.title) as string } : {}),
        rows: section.rows.map((rowValue, rowIndex) => {
          const row = requiredRecord(rowValue, `sections.${sectionIndex}.rows.${rowIndex}`);
          return {
            id: requiredString(row.id, "row.id"),
            title: requiredString(row.title, "row.title"),
            ...(optionalString(row.description) ? { description: optionalString(row.description) as string } : {})
          };
        })
      };
    });
    if (rowCount > 100) throw new Error("Jumlah row list maksimal 100");
    return { kind, to, text: requiredString(input.text, "text"), buttonText: requiredString(input.button_text, "button_text"), sections, ...(optionalString(input.title) ? { title: optionalString(input.title) as string } : {}), ...(optionalString(input.footer) ? { footer: optionalString(input.footer) as string } : {}), ...(input.quoted ? { quoted: input.quoted } : {}) };
  }
  if (kind === "broadcast") {
    if (!/^(\d+|status)@broadcast$/.test(to)) throw new Error("to harus berupa broadcast JID");
    return { kind, to, text: requiredString(input.text, "text"), ...(Array.isArray(input.status_jid_list) ? { statusJidList: input.status_jid_list.map(String) } : {}), ...(optionalString(input.background_color) ? { backgroundColor: optionalString(input.background_color) as string } : {}), ...(typeof input.font === "number" ? { font: input.font } : {}) };
  }
  if (kind === "reaction") return { kind, to, key: requiredKey(input.key), emoji: requiredString(input.emoji, "emoji") };
  if (kind === "delete") {
    const scope = optionalString(input.scope) ?? "everyone";
    if (scope !== "me" && scope !== "everyone") throw new Error("scope harus me atau everyone");
    return { kind, to, key: requiredKey(input.key), scope, ...(typeof input.timestamp === "number" ? { timestamp: input.timestamp } : {}), deleteMedia: input.delete_media === true };
  }
  if (kind === "edit") return { kind, to, key: requiredKey(input.key), text: requiredString(input.text, "text") };
  if (kind === "forward") return { kind, to, message: input.message };
  throw new Error("kind pesan tidak didukung");
}

function requiredKey(value: unknown): { remoteJid: string; id: string; fromMe?: boolean; participant?: string } {
  const record = requiredRecord(value, "key");
  return { remoteJid: requiredString(record.remoteJid, "key.remoteJid"), id: requiredString(record.id, "key.id"), ...(typeof record.fromMe === "boolean" ? { fromMe: record.fromMe } : {}), ...(optionalString(record.participant) ? { participant: optionalString(record.participant) as string } : {}) };
}

async function readJson(request: any, maxBytes: number): Promise<Record<string, unknown>> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = chunk instanceof Uint8Array ? chunk : Buffer.from(chunk);
    size += bytes.byteLength;
    if (size > maxBytes) throw new Error("Payload terlalu besar");
    chunks.push(bytes);
  }
  if (size === 0) return {};
  const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  return requiredRecord(parsed, "JSON body");
}

function success(response: any, status: number, requestId: string, data: unknown): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify({ success: true, data, error: null, meta: { request_id: requestId, timestamp: new Date().toISOString() } }));
}

function failure(response: any, status: number, requestId: string, code: string, message: string): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify({ success: false, data: null, error: { code, message }, meta: { request_id: requestId, timestamp: new Date().toISOString() } }));
}

function freshSession(sessionId: string): SessionView {
  return { sessionId, state: "disconnected", qrPayload: null, qrPng: null, qrBase64: null, qrDataUrl: null, pairingCode: null, phone: null, updatedAt: new Date().toISOString(), lastError: null };
}

function clearQr(view: SessionView): void {
  view.qrPayload = null;
  view.qrPng = null;
  view.qrBase64 = null;
  view.qrDataUrl = null;
  view.pairingCode = null;
}

function requireSessionQr(sessions: Map<string, SessionView>, sessionId: string): SessionView {
  const view = sessions.get(sessionId);
  if (!view?.qrPng || !view.qrBase64 || !view.qrDataUrl) throw new Error("QR_NOT_AVAILABLE");
  return view;
}

function sessionResponse(view: SessionView): Record<string, unknown> {
  return {
    sessionId: view.sessionId,
    state: view.state,
    qr_available: Boolean(view.qrPng),
    qr_data_url: view.qrDataUrl,
    pairingCode: view.pairingCode,
    phone: view.phone,
    updatedAt: view.updatedAt,
    lastError: view.lastError
  };
}

function validSessionId(value: string): string {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(value)) throw new Error("session_id tidak valid");
  return value;
}

function header(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} wajib diisi`);
  return value.trim();
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredNumber(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${name} wajib berupa angka`);
  return value;
}

function requiredRecord(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} wajib berupa object`);
  return value as Record<string, unknown>;
}

function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function statusFor(message: string): number {
  if (message.includes("OUTBOUND_QUEUE_FULL")) return 429;
  if (message.includes("SESSION_LOCKED")) return 409;
  if (message.includes("QR_NOT_AVAILABLE")) return 404;
  if (message.includes("NATIVE_PROTOCOL_BLOCKED")) return 501;
  return 400;
}
function errorCode(message: string): string {
  if (message.includes("OUTBOUND_QUEUE_FULL")) return "OUTBOUND_QUEUE_FULL";
  if (message.includes("SESSION_LOCKED")) return "SESSION_LOCKED";
  if (message.includes("QR_NOT_AVAILABLE")) return "QR_NOT_AVAILABLE";
  if (message.includes("NATIVE_PROTOCOL_BLOCKED")) return "NATIVE_PROTOCOL_BLOCKED";
  return "LIVE_PROVIDER_ERROR";
}
function safeFileName(value: string): string { return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160) || "download.bin"; }
function waitForDrain(response: any): Promise<void> { return new Promise((resolve) => response.once("drain", resolve)); }

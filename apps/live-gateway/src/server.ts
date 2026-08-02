import http = require("node:http");
import crypto = require("node:crypto");
import { ApiKeyAuthenticator } from "../../gateway/src/api-key-auth";
import { FixedWindowRateLimiter } from "../../gateway/src/rate-limiter";
import { ProviderManager } from "../../../packages/provider-contract/src/provider-manager";
import type { ProviderConnectionState, ProviderSendRequest } from "../../../packages/provider-contract/src/types";
import { BaileysProviderFactory } from "../../../packages/provider-baileys/src/factory";
import { WebhookService } from "../../../packages/webhook/src/webhook-service";
import type { LiveGatewayConfig } from "./config";

interface SessionView {
  sessionId: string;
  state: ProviderConnectionState;
  qr: string | null;
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
  const providers = new ProviderManager(new BaileysProviderFactory({ authRootDir: config.authRootDir }));
  const sessions = new Map<string, SessionView>();
  const authenticator = new ApiKeyAuthenticator(config.apiKeyHash);
  const limiter = new FixedWindowRateLimiter(config.rateLimitPerMinute, 60_000);
  const webhooks = new WebhookService(config.webhookTimeoutMs, config.webhookMaxRetries);
  if (config.webhookUrl && config.webhookSecret) webhooks.create({ url: config.webhookUrl, secret: config.webhookSecret, events: ["*"] });

  providers.onEvent(async (event) => {
    const current = sessions.get(event.sessionId) ?? freshSession(event.sessionId);
    current.updatedAt = new Date().toISOString();
    if (event.type === "connection.update") {
      current.state = event.state;
      current.lastError = event.state === "error" ? event.reason ?? "provider error" : null;
      if (event.state === "connected") {
        current.qr = null;
        current.pairingCode = null;
      }
    } else if (event.type === "pairing.qr") {
      current.state = "awaiting_pairing";
      current.qr = event.qr;
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
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("X-Request-Id", requestId);
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    try {
      const method = request.method ?? "GET";
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
      if (method === "GET" && url.pathname === "/health") return success(response, 200, requestId, { status: "ok", provider: "baileys" });
      if (method === "GET" && url.pathname === "/ready") return success(response, 200, requestId, { ready: true, provider: "baileys", unofficial: true });

      const apiKey = header(request.headers, "x-api-key");
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
        return success(response, 200, requestId, [...sessions.values()]);
      }

      if (segments[0] === "api" && segments[1] === "v1" && segments[2] === "live" && segments[3] === "sessions" && segments[4]) {
        const sessionId = validSessionId(decodeURIComponent(segments[4]));
        const action = segments[5];
        if (!action && method === "GET") return success(response, 200, requestId, sessions.get(sessionId) ?? freshSession(sessionId));
        if (action === "connect" && method === "POST") {
          const input = await body();
          const phone = optionalString(input.phone);
          const view = sessions.get(sessionId) ?? freshSession(sessionId);
          view.state = "connecting";
          view.phone = phone;
          view.updatedAt = new Date().toISOString();
          sessions.set(sessionId, view);
          await providers.connect(sessionId, { ...(phone ? { phone } : {}), syncFullHistory: input.sync_full_history === true });
          return success(response, 202, requestId, view);
        }
        if (action === "pairing-code" && method === "POST") {
          const input = await body();
          const phone = requiredString(input.phone, "phone");
          const code = await providers.requestPairingCode(sessionId, phone);
          return success(response, 200, requestId, { session_id: sessionId, phone, pairing_code: code });
        }
        if (action === "disconnect" && method === "POST") {
          await providers.disconnect(sessionId);
          return success(response, 200, requestId, sessions.get(sessionId) ?? freshSession(sessionId));
        }
        if (action === "logout" && method === "POST") {
          await providers.logout(sessionId);
          return success(response, 200, requestId, sessions.get(sessionId) ?? freshSession(sessionId));
        }
        if (action === "messages" && method === "POST") {
          const input = await body();
          const requestBody = validateSendRequest(input);
          return success(response, 202, requestId, await providers.send(sessionId, requestBody));
        }
        if (action === "media" && segments[6] === "download" && method === "POST") {
          const input = await body();
          const bytes = await providers.get(sessionId).downloadMedia(input.message);
          return success(response, 200, requestId, { base64: Buffer.from(bytes).toString("base64"), size: bytes.byteLength });
        }
        if (action === "contacts" && method === "GET") return success(response, 200, requestId, await providers.get(sessionId).getContacts());
        if (action === "chats" && method === "GET") return success(response, 200, requestId, await providers.get(sessionId).getChats());
        if (action === "numbers" && segments[6] === "check" && method === "POST") {
          const input = await body();
          if (!Array.isArray(input.numbers)) throw new Error("numbers wajib berupa array");
          return success(response, 200, requestId, await providers.get(sessionId).checkNumbers(input.numbers.map(String)));
        }
        if (action === "presence" && method === "POST") {
          const input = await body();
          const state = requiredString(input.state, "state") as "available" | "unavailable" | "composing" | "recording" | "paused";
          if (!["available", "unavailable", "composing", "recording", "paused"].includes(state)) throw new Error("state presence tidak valid");
          await providers.get(sessionId).setPresence(state, optionalString(input.jid));
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
      return failure(response, 400, requestId, "LIVE_PROVIDER_ERROR", errorMessage(error));
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
    const media = input.media;
    if (!media || typeof media !== "object" || Array.isArray(media)) throw new Error("media wajib berupa object");
    return { kind: kind as "image" | "video" | "audio" | "document" | "sticker", to, media: media as any, ...(optionalString(input.caption) ? { caption: optionalString(input.caption) as string } : {}), voiceNote: input.voice_note === true, gifPlayback: input.gif_playback === true, ...(input.quoted ? { quoted: input.quoted } : {}) };
  }
  if (kind === "location") return { kind, to, latitude: requiredNumber(input.latitude, "latitude"), longitude: requiredNumber(input.longitude, "longitude"), ...(optionalString(input.name) ? { name: optionalString(input.name) as string } : {}), ...(optionalString(input.address) ? { address: optionalString(input.address) as string } : {}) };
  if (kind === "contact") return { kind, to, displayName: requiredString(input.display_name, "display_name"), vcard: requiredString(input.vcard, "vcard") };
  if (kind === "poll") {
    if (!Array.isArray(input.options)) throw new Error("options wajib berupa array");
    return { kind, to, question: requiredString(input.question, "question"), options: input.options.map(String), ...(typeof input.selectable_count === "number" ? { selectableCount: input.selectable_count } : {}) };
  }
  if (kind === "reaction") return { kind, to, key: requiredKey(input.key), emoji: requiredString(input.emoji, "emoji") };
  if (kind === "delete") return { kind, to, key: requiredKey(input.key) };
  if (kind === "edit") return { kind, to, key: requiredKey(input.key), text: requiredString(input.text, "text") };
  if (kind === "forward") return { kind, to, message: input.message };
  throw new Error("kind pesan tidak didukung");
}

function requiredKey(value: unknown): { remoteJid: string; id: string; fromMe?: boolean; participant?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("key wajib berupa object");
  const record = value as Record<string, unknown>;
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
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("JSON body wajib berupa object");
  return parsed as Record<string, unknown>;
}

function success(response: any, status: number, requestId: string, data: unknown): void {
  response.statusCode = status;
  response.end(JSON.stringify({ success: true, data, error: null, meta: { request_id: requestId, timestamp: new Date().toISOString() } }));
}

function failure(response: any, status: number, requestId: string, code: string, message: string): void {
  response.statusCode = status;
  response.end(JSON.stringify({ success: false, data: null, error: { code, message }, meta: { request_id: requestId, timestamp: new Date().toISOString() } }));
}

function freshSession(sessionId: string): SessionView {
  return { sessionId, state: "disconnected", qr: null, pairingCode: null, phone: null, updatedAt: new Date().toISOString(), lastError: null };
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

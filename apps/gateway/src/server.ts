import http = require("node:http");
import crypto = require("node:crypto");
import path = require("node:path");
import { OpenSrcWaError, asOpenSrcWaError } from "../../../packages/core/src/errors";
import type { ApiFailure, ApiSuccess } from "../../../packages/core/src/types";
import { requireRecord, requireString } from "../../../packages/core/src/validation";
import { CryptoProvider } from "../../../packages/crypto/src/crypto-provider";
import { PairingController } from "../../../packages/auth/src/pairing-controller";
import { SessionManager } from "../../../packages/auth/src/session-manager";
import { EncryptedFileSessionStore } from "../../../packages/session-store/src/encrypted-file-store";
import type { SessionStore } from "../../../packages/session-store/src/types";
import { MessageService, type MessageType } from "../../../packages/messaging/src/message-service";
import { MediaService, type MediaKind } from "../../../packages/media/src/media-service";
import { CapabilityRegistry } from "../../../packages/capabilities/src/registry";
import {
  BusinessService,
  CallService,
  ChannelService,
  ChatService,
  CommunityService,
  ContactService,
  GroupService,
  HistoryService,
  LabelService,
  PresenceService,
  PrivacyService,
  StatusService,
  type PresenceState
} from "../../../packages/domain/src";
import { PluginRegistry } from "../../../packages/plugins/src/plugin-registry";
import { WebhookService } from "../../../packages/webhook/src/webhook-service";
import { JsonLogger, type Logger } from "../../../packages/observability/src/logger";
import { MetricsRegistry } from "../../../packages/observability/src/metrics";
import { openApiDocument } from "../../../packages/api-contract/src/openapi";
import { ApiKeyAuthenticator } from "./api-key-auth";
import { FixedWindowRateLimiter } from "./rate-limiter";
import { WebSocketEventHub } from "./websocket-hub";
import type { GatewayConfig } from "./config";
import { dashboardHtml } from "../../dashboard/src/page";

interface RequestLike {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  socket: { remoteAddress?: string };
  on(event: string, handler: (chunk?: Uint8Array) => void): void;
}
interface ResponseLike {
  statusCode: number;
  setHeader(name: string, value: string | number): void;
  end(data?: string | Uint8Array): void;
}

export interface GatewayRuntime {
  server: any;
  sessions: SessionManager;
  messages: MessageService;
  media: MediaService;
  contacts: ContactService;
  chats: ChatService;
  groups: GroupService;
  presence: PresenceService;
  statuses: StatusService;
  channels: ChannelService;
  communities: CommunityService;
  business: BusinessService;
  labels: LabelService;
  calls: CallService;
  privacy: PrivacyService;
  history: HistoryService;
  capabilities: CapabilityRegistry;
  plugins: PluginRegistry;
  webhooks: WebhookService;
  metrics: MetricsRegistry;
  websocket: WebSocketEventHub;
  close(): Promise<void>;
}

interface RouteServices {
  sessions: SessionManager;
  messages: MessageService;
  media: MediaService;
  contacts: ContactService;
  chats: ChatService;
  groups: GroupService;
  presence: PresenceService;
  statuses: StatusService;
  channels: ChannelService;
  communities: CommunityService;
  business: BusinessService;
  labels: LabelService;
  calls: CallService;
  privacy: PrivacyService;
  history: HistoryService;
  capabilities: CapabilityRegistry;
  plugins: PluginRegistry;
  webhooks: WebhookService;
}

export function createGateway(config: GatewayConfig, options?: { logger?: Logger; store?: SessionStore }): GatewayRuntime {
  const logger = options?.logger ?? new JsonLogger(process.env.NODE_ENV === "development" ? "debug" : "info");
  const metrics = new MetricsRegistry();
  const store = options?.store ?? createStore(config);
  const pairing = new PairingController();
  const sessions = new SessionManager(store, pairing, config.protocolMode);
  const contacts = new ContactService();
  const chats = new ChatService();
  const plugins = new PluginRegistry();
  const messages = new MessageService(sessions, config.protocolMode, { contacts, chats, runHook: (hook, sessionId, payload) => plugins.run(hook, sessionId, payload) });
  const media = new MediaService(config.maxBodyBytes);
  const groups = new GroupService();
  const presence = new PresenceService();
  const statuses = new StatusService();
  const channels = new ChannelService();
  const communities = new CommunityService();
  const business = new BusinessService();
  const labels = new LabelService();
  const calls = new CallService();
  const privacy = new PrivacyService();
  const history = new HistoryService();
  const capabilities = new CapabilityRegistry();
  const webhooks = new WebhookService(config.webhookTimeoutMs, config.webhookMaxRetries);
  const auth = new ApiKeyAuthenticator(config.apiKeyHash);
  const limiter = new FixedWindowRateLimiter(config.rateLimitPerMinute, 60_000);
  const websocket = new WebSocketEventHub();
  const services: RouteServices = { sessions, messages, media, contacts, chats, groups, presence, statuses, channels, communities, business, labels, calls, privacy, history, capabilities, plugins, webhooks };

  const publish = (eventName: string, event: unknown): void => {
    websocket.publish(event);
    metrics.increment(`opensrc_wa_events_total_${eventName.replaceAll(".", "_")}`);
    void webhooks.publish(eventName, event);
  };
  sessions.on("connection.update", (event) => publish("connection.update", event));
  sessions.on("pairing.qr", (event) => publish("session.qr", event));
  sessions.on("pairing.code", (event) => publish("session.pairing_code", event));
  sessions.on("session.ready", (event) => { publish("session.ready", event); void plugins.run("session.ready", event.sessionId, event); });
  sessions.on("logged.out", (event) => publish("session.logged_out", event));
  messages.on("message.received", (event) => publish("message.received", event));
  messages.on("message.sent", (event) => publish("message.sent", event));
  messages.on("message.ack", (event) => publish("message.ack", event));
  messages.on("message.updated", (event) => publish("message.updated", event));
  messages.on("message.failed", (event) => publish("message.failed", event));

  const server = http.createServer(async (request: RequestLike, response: ResponseLike) => {
    const requestId = crypto.randomUUID();
    const startedAt = Date.now();
    secureHeaders(response, requestId);
    applyCors(request, response, config.corsOrigins);
    try {
      const method = request.method ?? "GET";
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
      if (method === "OPTIONS") return sendEmpty(response, 204);
      if (method === "GET" && url.pathname === "/dashboard") {
        response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'");
        return sendText(response, 200, dashboardHtml, "text/html; charset=utf-8");
      }
      if (method === "GET" && url.pathname === "/health") return sendSuccess(response, 200, requestId, { status: "ok", uptime_seconds: Math.floor(process.uptime()) });
      if (method === "GET" && url.pathname === "/ready") return sendSuccess(response, 200, requestId, { ready: true, protocol_mode: config.protocolMode, live_protocol: "BLOCKED", mock_runtime: "READY" });
      if (method === "GET" && url.pathname === "/version") return sendSuccess(response, 200, requestId, { name: "opensrc_wa", version: "0.2.0", protocol_status: "BLOCKED", feature_runtime: "TESTED_WITH_MOCK" });
      if (method === "GET" && url.pathname === "/openapi.json") return sendJson(response, 200, openApiDocument);
      if (method === "GET" && url.pathname === "/metrics") return sendText(response, 200, metrics.toPrometheus(), "text/plain; version=0.0.4");

      const apiKey = header(request.headers, "x-api-key");
      if (!auth.verify(apiKey)) throw new OpenSrcWaError({ code: "UNAUTHORIZED", category: "AUTH_ERROR", message: "API key tidak valid" });
      const identity = new CryptoProvider().sha256(apiKey ?? "").slice(0, 16);
      const rate = limiter.consume(`${identity}:${request.socket.remoteAddress ?? "unknown"}`);
      response.setHeader("X-RateLimit-Limit", config.rateLimitPerMinute);
      response.setHeader("X-RateLimit-Remaining", rate.remaining);
      response.setHeader("X-RateLimit-Reset", Math.ceil(rate.resetAt / 1000));
      if (!rate.allowed) throw new OpenSrcWaError({ code: "RATE_LIMITED", category: "RATE_LIMIT_ERROR", message: "Batas request terlampaui", retryable: true });
      metrics.increment("opensrc_wa_http_requests_total");
      await route({ request, response, method, url, requestId, config, services });
    } catch (error) {
      const normalized = asOpenSrcWaError(error);
      const status = statusFor(normalized.code);
      metrics.increment(`opensrc_wa_http_errors_total_${normalized.category.toLowerCase()}`);
      logger.warn("request.failed", { request_id: requestId, code: normalized.code, category: normalized.category, status, duration_ms: Date.now() - startedAt });
      sendFailure(response, status, requestId, normalized);
    } finally {
      metrics.gauge("opensrc_wa_last_request_duration_ms", Date.now() - startedAt);
    }
  });

  server.on("upgrade", (request: RequestLike, socket: any) => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
      if (url.pathname !== "/api/v1/events") return socket.destroy();
      const apiKey = header(request.headers, "x-api-key") || url.searchParams.get("api_key") || undefined;
      if (!auth.verify(apiKey)) return socket.destroy();
      if (!websocket.accept(request, socket)) socket.destroy();
    } catch { socket.destroy(); }
  });

  const close = async (): Promise<void> => {
    websocket.closeAll();
    await new Promise<void>((resolve, reject) => server.close((error?: Error) => error ? reject(error) : resolve()));
  };

  return { server, ...services, metrics, websocket, close };
}

async function route(context: { request: RequestLike; response: ResponseLike; method: string; url: URL; requestId: string; config: GatewayConfig; services: RouteServices }): Promise<void> {
  const { request, response, method, url, requestId, config, services } = context;
  const { sessions, messages, media, contacts, chats, groups, presence, statuses, channels, communities, business, labels, calls, privacy, history, capabilities, plugins, webhooks } = services;
  const segments = url.pathname.split("/").filter(Boolean);
  const body = async (): Promise<Record<string, unknown>> => requireRecord(await readJson(request, config.maxBodyBytes));

  if (url.pathname === "/api/v1/capabilities" && method === "GET") {
    const domain = optionalQuery(url, "domain") as Parameters<typeof capabilities.list>[0] extends { domain?: infer T } ? T : never;
    const status = optionalQuery(url, "status") as Parameters<typeof capabilities.list>[0] extends { status?: infer T } ? T : never;
    return sendSuccess(response, 200, requestId, { summary: capabilities.summary(), features: capabilities.list({ ...(domain ? { domain } : {}), ...(status ? { status } : {}) }) });
  }
  if (url.pathname === "/api/v1/plugins" && method === "GET") return sendSuccess(response, 200, requestId, plugins.list());

  if (url.pathname === "/api/v1/sessions" && method === "GET") return sendSuccess(response, 200, requestId, await sessions.list());
  if (url.pathname === "/api/v1/sessions/import" && method === "POST") {
    const input = await body();
    const session = isRecord(input.session) ? input.session : null;
    if (!session) throw validation("session snapshot wajib diisi");
    return sendSuccess(response, 201, requestId, await sessions.importMockSnapshot({ version: 1, session: session as unknown as import("../../../packages/session-store/src/types").SessionRecord }));
  }
  if (url.pathname === "/api/v1/sessions" && method === "POST") {
    const input = await body();
    const sessionId = requireString(input.session_id, "session_id", { min: 1, max: 64 });
    if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) throw validation("session_id hanya boleh berisi huruf, angka, _ dan -");
    return sendSuccess(response, 201, requestId, await sessions.create(sessionId));
  }
  if (segments[0] === "api" && segments[1] === "v1" && segments[2] === "sessions" && segments[3]) {
    const sessionId = decodeURIComponent(segments[3]);
    const action = segments[4];
    if (!action && method === "GET") return sendSuccess(response, 200, requestId, await sessions.get(sessionId));
    if (!action && method === "DELETE") { await sessions.delete(sessionId); return sendEmpty(response, 204); }
    if (action === "export" && method === "GET") return sendSuccess(response, 200, requestId, await sessions.exportMockSnapshot(sessionId));
    if (action === "connect" && method === "POST") return sendSuccess(response, 200, requestId, await sessions.connect(sessionId));
    if (action === "disconnect" && method === "POST") return sendSuccess(response, 200, requestId, await sessions.disconnect(sessionId));
    if (action === "logout" && method === "POST") return sendSuccess(response, 200, requestId, await sessions.logout(sessionId));
    if (action === "status" && method === "GET") return sendSuccess(response, 200, requestId, await sessions.get(sessionId));
    if (action === "qr" && method === "GET") {
      const challenge = sessions.getPairing(sessionId);
      if (!challenge || challenge.method !== "qr") throw new OpenSrcWaError({ code: "PAIRING_NOT_AVAILABLE", category: "PAIRING_ERROR", message: "QR pairing tidak tersedia atau kedaluwarsa" });
      return sendSuccess(response, 200, requestId, challenge);
    }
    if (action === "pairing-code" && method === "POST") {
      const input = await body();
      return sendSuccess(response, 200, requestId, await sessions.requestMockPairingCode(sessionId, requireString(input.phone, "phone", { min: 8, max: 16 })));
    }
    if (action === "mock-complete-pairing" && method === "POST") return sendSuccess(response, 200, requestId, await sessions.completeMockPairing(sessionId));
  }

  if (url.pathname === "/api/v1/messages" && method === "GET") return sendSuccess(response, 200, requestId, messages.list({
    ...(optionalQuery(url, "session_id") ? { sessionId: optionalQuery(url, "session_id") as string } : {}),
    ...(optionalQuery(url, "chat_id") ? { chatId: optionalQuery(url, "chat_id") as string } : {}),
    ...(optionalQuery(url, "direction") ? { direction: optionalQuery(url, "direction") as "incoming" | "outgoing" } : {}),
    ...(optionalQuery(url, "type") ? { type: optionalQuery(url, "type") as MessageType } : {}),
    ...(optionalQuery(url, "q") ? { query: optionalQuery(url, "q") as string } : {})
  }).map(publicMessage));
  if (url.pathname === "/api/v1/messages/text" && method === "POST") {
    const input = await body();
    return sendSuccess(response, 202, requestId, publicMessage(await messages.sendText({ sessionId: field(input, "session_id", 64), to: field(input, "to", 128), text: field(input, "text", 4096), idempotencyKey: field(input, "idempotency_key", 128), ...(optionalString(input.quoted_message_id) ? { quotedMessageId: optionalString(input.quoted_message_id) as string } : {}), ...(typeof input.view_once === "boolean" ? { viewOnce: input.view_once } : {}), ...(typeof input.disappearing_seconds === "number" ? { disappearingSeconds: input.disappearing_seconds } : {}) })));
  }
  if (url.pathname === "/api/v1/messages/media" && method === "POST") {
    const input = await body();
    return sendSuccess(response, 202, requestId, publicMessage(await messages.sendMedia({ sessionId: field(input, "session_id", 64), to: field(input, "to", 128), mediaId: field(input, "media_id", 128), mediaType: field(input, "media_type", 16) as "image" | "video" | "audio" | "document" | "sticker", idempotencyKey: field(input, "idempotency_key", 128), ...(optionalString(input.caption) ? { caption: optionalString(input.caption) as string } : {}), ...(optionalString(input.quoted_message_id) ? { quotedMessageId: optionalString(input.quoted_message_id) as string } : {}), ...(typeof input.view_once === "boolean" ? { viewOnce: input.view_once } : {}) })));
  }
  if (url.pathname === "/api/v1/messages/location" && method === "POST") {
    const input = await body();
    return sendSuccess(response, 202, requestId, publicMessage(await messages.sendLocation({ sessionId: field(input, "session_id", 64), to: field(input, "to", 128), latitude: requiredNumber(input.latitude, "latitude"), longitude: requiredNumber(input.longitude, "longitude"), idempotencyKey: field(input, "idempotency_key", 128), ...(optionalString(input.name) ? { name: optionalString(input.name) as string } : {}), ...(optionalString(input.address) ? { address: optionalString(input.address) as string } : {}), ...(typeof input.live_period_seconds === "number" ? { livePeriodSeconds: input.live_period_seconds } : {}) })));
  }
  if (url.pathname === "/api/v1/messages/contact" && method === "POST") {
    const input = await body();
    return sendSuccess(response, 202, requestId, publicMessage(await messages.sendContact({ sessionId: field(input, "session_id", 64), to: field(input, "to", 128), displayName: field(input, "display_name", 256), vcard: field(input, "vcard", 8192), idempotencyKey: field(input, "idempotency_key", 128) })));
  }
  if (url.pathname === "/api/v1/messages/poll" && method === "POST") {
    const input = await body();
    return sendSuccess(response, 202, requestId, publicMessage(await messages.sendPoll({ sessionId: field(input, "session_id", 64), to: field(input, "to", 128), question: field(input, "question", 4096), options: stringArray(input.options, "options"), idempotencyKey: field(input, "idempotency_key", 128), ...(typeof input.selectable_count === "number" ? { selectableCount: input.selectable_count } : {}) })));
  }
  if (url.pathname === "/api/v1/messages/mock-incoming" && method === "POST") {
    const input = await body();
    return sendSuccess(response, 201, requestId, publicMessage(await messages.injectIncoming({ sessionId: field(input, "session_id", 64), from: field(input, "from", 128), ...(optionalString(input.chat_id) ? { chatId: optionalString(input.chat_id) as string } : {}), ...(optionalString(input.type) ? { type: optionalString(input.type) as MessageType } : {}), ...(optionalString(input.text) ? { text: optionalString(input.text) as string } : {}), ...(isRecord(input.content) ? { content: input.content } : {}), ...(optionalString(input.message_id) ? { messageId: optionalString(input.message_id) as string } : {}), ...(optionalString(input.quoted_message_id) ? { quotedMessageId: optionalString(input.quoted_message_id) as string } : {}) })));
  }
  if (segments[0] === "api" && segments[1] === "v1" && segments[2] === "messages" && segments[3]) {
    const messageId = segments[3];
    const action = segments[4];
    if (!action && method === "GET") {
      const message = messages.get(messageId);
      if (!message) throw new OpenSrcWaError({ code: "MESSAGE_NOT_FOUND", category: "MESSAGE_ERROR", message: "Pesan tidak ditemukan" });
      return sendSuccess(response, 200, requestId, publicMessage(message));
    }
    if (!action && method === "PATCH") { const input = await body(); return sendSuccess(response, 200, requestId, publicMessage(await messages.edit(field(input, "session_id", 64), messageId, field(input, "text", 4096)))); }
    if (!action && method === "DELETE") return sendSuccess(response, 200, requestId, publicMessage(await messages.delete(requiredQuery(url, "session_id"), messageId, (optionalQuery(url, "scope") ?? "self") as "self" | "everyone")));
    if (action === "reactions" && method === "POST") { const input = await body(); return sendSuccess(response, 200, requestId, publicMessage(await messages.react(field(input, "session_id", 64), messageId, field(input, "jid", 128), field(input, "emoji", 32)))); }
    if (action === "forward" && method === "POST") { const input = await body(); return sendSuccess(response, 202, requestId, publicMessage(await messages.forward(field(input, "session_id", 64), messageId, field(input, "to", 128), field(input, "idempotency_key", 128)))); }
    if (action === "receipts" && method === "POST") { const input = await body(); return sendSuccess(response, 200, requestId, publicMessage(await messages.setReceipt(field(input, "session_id", 64), messageId, field(input, "jid", 128), field(input, "status", 16) as "delivered" | "read" | "played"))); }
  }

  if (url.pathname === "/api/v1/media" && method === "GET") return sendSuccess(response, 200, requestId, media.list(requiredQuery(url, "session_id")));
  if (url.pathname === "/api/v1/media" && method === "POST") {
    const input = await body();
    return sendSuccess(response, 201, requestId, media.upload({ sessionId: field(input, "session_id", 64), kind: field(input, "kind", 16) as MediaKind, fileName: field(input, "file_name", 256), mimeType: field(input, "mime_type", 128), contentBase64: field(input, "content_base64", config.maxBodyBytes), ...(optionalString(input.caption) ? { caption: optionalString(input.caption) as string } : {}), ...(typeof input.voice_note === "boolean" ? { voiceNote: input.voice_note } : {}), ...(typeof input.view_once === "boolean" ? { viewOnce: input.view_once } : {}) }));
  }
  if (segments[0] === "api" && segments[1] === "v1" && segments[2] === "media" && segments[3]) {
    const sessionId = requiredQuery(url, "session_id");
    if (method === "GET") return sendSuccess(response, 200, requestId, optionalQuery(url, "include_content") === "true" ? media.download(sessionId, segments[3]) : media.get(sessionId, segments[3]));
    if (method === "DELETE") { media.delete(sessionId, segments[3]); return sendEmpty(response, 204); }
  }

  if (url.pathname === "/api/v1/contacts/check" && method === "GET") return sendSuccess(response, 200, requestId, contacts.checkRegistration(requiredQuery(url, "phone")));
  if (url.pathname === "/api/v1/contacts" && method === "GET") return sendSuccess(response, 200, requestId, contacts.list(requiredQuery(url, "session_id")));
  if (url.pathname === "/api/v1/contacts" && method === "POST") { const input = await body(); return sendSuccess(response, 201, requestId, contacts.upsert({ sessionId: field(input, "session_id", 64), phone: field(input, "phone", 16), ...(optionalString(input.name) ? { name: optionalString(input.name) as string } : {}), ...(optionalString(input.push_name) ? { pushName: optionalString(input.push_name) as string } : {}), ...(optionalString(input.about) ? { about: optionalString(input.about) as string } : {}) })); }
  if (segments[0] === "api" && segments[1] === "v1" && segments[2] === "contacts" && segments[3] && segments[3] !== "check") {
    const phone = segments[3];
    const action = segments[4];
    if (!action && method === "GET") return sendSuccess(response, 200, requestId, contacts.get(requiredQuery(url, "session_id"), phone));
    if (!action && method === "PATCH") { const input = await body(); return sendSuccess(response, 200, requestId, contacts.setProfile({ sessionId: field(input, "session_id", 64), phone, ...(optionalString(input.about) ? { about: optionalString(input.about) as string } : {}), ...(input.profile_picture_url === null || typeof input.profile_picture_url === "string" ? { profilePictureUrl: input.profile_picture_url } : {}) })); }
    if (!action && method === "DELETE") { contacts.remove(requiredQuery(url, "session_id"), phone); return sendEmpty(response, 204); }
    if (action === "block" && method === "POST") { const input = await body(); return sendSuccess(response, 200, requestId, contacts.setBlocked(field(input, "session_id", 64), phone, true)); }
    if (action === "unblock" && method === "POST") { const input = await body(); return sendSuccess(response, 200, requestId, contacts.setBlocked(field(input, "session_id", 64), phone, false)); }
    if (action === "consent" && method === "POST") { const input = await body(); return sendSuccess(response, 200, requestId, contacts.grantConsent(field(input, "session_id", 64), phone, field(input, "basis", 512))); }
    if (action === "revoke-consent" && method === "POST") { const input = await body(); return sendSuccess(response, 200, requestId, contacts.revokeConsent(field(input, "session_id", 64), phone)); }
  }

  if (url.pathname === "/api/v1/chats" && method === "GET") return sendSuccess(response, 200, requestId, optionalQuery(url, "q") ? chats.search(requiredQuery(url, "session_id"), optionalQuery(url, "q") as string) : chats.list(requiredQuery(url, "session_id")));
  if (segments[0] === "api" && segments[1] === "v1" && segments[2] === "chats" && segments[3]) {
    const chatId = decodeURIComponent(segments[3]);
    if (segments[4] === "messages" && method === "GET") return sendSuccess(response, 200, requestId, messages.list({ sessionId: requiredQuery(url, "session_id"), chatId, ...(optionalQuery(url, "q") ? { query: optionalQuery(url, "q") as string } : {}) }).map(publicMessage));
    if (method === "GET") return sendSuccess(response, 200, requestId, chats.get(requiredQuery(url, "session_id"), chatId));
    if (method === "PATCH") { const input = await body(); return sendSuccess(response, 200, requestId, chats.update(field(input, "session_id", 64), chatId, { ...(typeof input.archived === "boolean" ? { archived: input.archived } : {}), ...(typeof input.pinned === "boolean" ? { pinned: input.pinned } : {}), ...(input.muted_until === null || typeof input.muted_until === "string" ? { mutedUntil: input.muted_until } : {}), ...(typeof input.unread_count === "number" ? { unreadCount: input.unread_count } : {}), ...(optionalString(input.title) ? { title: optionalString(input.title) as string } : {}) })); }
  }

  if (url.pathname === "/api/v1/groups/join" && method === "POST") { const input = await body(); return sendSuccess(response, 200, requestId, groups.joinByInvite(field(input, "session_id", 64), field(input, "invite_code", 128), field(input, "jid", 128))); }
  if (url.pathname === "/api/v1/groups" && method === "GET") return sendSuccess(response, 200, requestId, groups.list(requiredQuery(url, "session_id")));
  if (url.pathname === "/api/v1/groups" && method === "POST") { const input = await body(); return sendSuccess(response, 201, requestId, groups.create({ sessionId: field(input, "session_id", 64), subject: field(input, "subject", 256), ...(Array.isArray(input.participants) ? { participants: stringArray(input.participants, "participants") } : {}) })); }
  if (segments[0] === "api" && segments[1] === "v1" && segments[2] === "groups" && segments[3] && segments[3] !== "join") {
    const groupId = decodeURIComponent(segments[3]);
    const action = segments[4];
    if (!action && method === "GET") return sendSuccess(response, 200, requestId, groups.get(requiredQuery(url, "session_id"), groupId));
    if (!action && method === "PATCH") { const input = await body(); return sendSuccess(response, 200, requestId, groups.update(field(input, "session_id", 64), groupId, { ...(optionalString(input.subject) ? { subject: optionalString(input.subject) as string } : {}), ...(optionalString(input.description) ? { description: optionalString(input.description) as string } : {}), ...(input.picture_url === null || typeof input.picture_url === "string" ? { pictureUrl: input.picture_url } : {}), ...(typeof input.announce === "boolean" ? { announce: input.announce } : {}), ...(typeof input.locked === "boolean" ? { locked: input.locked } : {}), ...(typeof input.approval_required === "boolean" ? { approvalRequired: input.approval_required } : {}), ...(input.disappearing_seconds === null || typeof input.disappearing_seconds === "number" ? { disappearingSeconds: input.disappearing_seconds } : {}) })); }
    if (action === "participants" && method === "POST") { const input = await body(); const operation = field(input, "operation", 16); const jids = stringArray(input.jids, "jids"); const sessionId = field(input, "session_id", 64); if (operation === "add") return sendSuccess(response, 200, requestId, groups.addParticipants(sessionId, groupId, jids)); if (operation === "remove") return sendSuccess(response, 200, requestId, groups.removeParticipants(sessionId, groupId, jids)); if (["member", "admin", "superadmin"].includes(operation)) return sendSuccess(response, 200, requestId, groups.setRole(sessionId, groupId, jids, operation as "member" | "admin" | "superadmin")); throw validation("operation peserta tidak valid"); }
    if (action === "invite" && method === "GET") return sendSuccess(response, 200, requestId, { invite_code: groups.get(requiredQuery(url, "session_id"), groupId).inviteCode });
    if (action === "revoke-invite" && method === "POST") { const input = await body(); return sendSuccess(response, 200, requestId, groups.revokeInvite(field(input, "session_id", 64), groupId)); }
    if (action === "leave" && method === "POST") { const input = await body(); return sendSuccess(response, 200, requestId, groups.leave(field(input, "session_id", 64), groupId, field(input, "jid", 128))); }
  }

  if (url.pathname === "/api/v1/presence" && method === "POST") { const input = await body(); return sendSuccess(response, 200, requestId, presence.set(field(input, "session_id", 64), field(input, "jid", 128), field(input, "state", 32) as PresenceState)); }
  if (url.pathname === "/api/v1/presence/subscribe" && method === "POST") { const input = await body(); return sendSuccess(response, 200, requestId, presence.subscribe(field(input, "session_id", 64), field(input, "jid", 128))); }
  if (segments[0] === "api" && segments[1] === "v1" && segments[2] === "presence" && segments[3] && method === "GET") return sendSuccess(response, 200, requestId, presence.get(requiredQuery(url, "session_id"), decodeURIComponent(segments[3])));

  if (url.pathname === "/api/v1/statuses" && method === "GET") return sendSuccess(response, 200, requestId, statuses.list(requiredQuery(url, "session_id")));
  if (url.pathname === "/api/v1/statuses" && method === "POST") { const input = await body(); return sendSuccess(response, 201, requestId, statuses.create({ sessionId: field(input, "session_id", 64), ownerJid: field(input, "owner_jid", 128), type: field(input, "type", 16) as "text" | "image" | "video" | "audio", ...(optionalString(input.text) ? { text: optionalString(input.text) as string } : {}), ...(optionalString(input.media_id) ? { mediaId: optionalString(input.media_id) as string } : {}), ...(optionalString(input.background_color) ? { backgroundColor: optionalString(input.background_color) as string } : {}), ...(typeof input.font === "number" ? { font: input.font } : {}) })); }
  if (segments[0] === "api" && segments[1] === "v1" && segments[2] === "statuses" && segments[3] && segments[4]) { const input = await body(); if (segments[4] === "view" && method === "POST") return sendSuccess(response, 200, requestId, statuses.view(field(input, "session_id", 64), segments[3], field(input, "viewer_jid", 128))); if (segments[4] === "reaction" && method === "POST") return sendSuccess(response, 200, requestId, statuses.react(field(input, "session_id", 64), segments[3], field(input, "jid", 128), field(input, "emoji", 32))); }

  if (url.pathname === "/api/v1/channels" && method === "GET") return sendSuccess(response, 200, requestId, channels.list(requiredQuery(url, "session_id")));
  if (url.pathname === "/api/v1/channels" && method === "POST") { const input = await body(); return sendSuccess(response, 201, requestId, channels.create({ sessionId: field(input, "session_id", 64), name: field(input, "name", 256), ownerJid: field(input, "owner_jid", 128), ...(optionalString(input.description) ? { description: optionalString(input.description) as string } : {}) })); }
  if (segments[0] === "api" && segments[1] === "v1" && segments[2] === "channels" && segments[3] && segments[4]) {
    const input = await body(); const sessionId = field(input, "session_id", 64);
    if (segments[4] === "follow" && method === "POST") return sendSuccess(response, 200, requestId, channels.follow(sessionId, decodeURIComponent(segments[3]), field(input, "jid", 128), true));
    if (segments[4] === "unfollow" && method === "POST") return sendSuccess(response, 200, requestId, channels.follow(sessionId, decodeURIComponent(segments[3]), field(input, "jid", 128), false));
    if (segments[4] === "updates" && !segments[5] && method === "POST") return sendSuccess(response, 201, requestId, channels.publish(sessionId, decodeURIComponent(segments[3]), { text: field(input, "text", 4096), ...(optionalString(input.media_id) ? { mediaId: optionalString(input.media_id) as string } : {}) }));
    if (segments[4] === "updates" && segments[5] && segments[6] === "reactions" && method === "POST") return sendSuccess(response, 200, requestId, channels.react(sessionId, decodeURIComponent(segments[3]), segments[5], field(input, "emoji", 32)));
  }

  if (url.pathname === "/api/v1/communities" && method === "GET") return sendSuccess(response, 200, requestId, communities.list(requiredQuery(url, "session_id")));
  if (url.pathname === "/api/v1/communities" && method === "POST") { const input = await body(); return sendSuccess(response, 201, requestId, communities.create({ sessionId: field(input, "session_id", 64), subject: field(input, "subject", 256), ownerJid: field(input, "owner_jid", 128), ...(optionalString(input.description) ? { description: optionalString(input.description) as string } : {}) })); }
  if (segments[0] === "api" && segments[1] === "v1" && segments[2] === "communities" && segments[3] && segments[4] === "subgroups" && method === "POST") { const input = await body(); return sendSuccess(response, 200, requestId, communities.attach(field(input, "session_id", 64), decodeURIComponent(segments[3]), field(input, "group_id", 128), input.attach !== false)); }

  if (url.pathname === "/api/v1/business/profile" && method === "GET") return sendSuccess(response, 200, requestId, business.getProfile(requiredQuery(url, "session_id")));
  if (url.pathname === "/api/v1/business/profile" && (method === "POST" || method === "PATCH")) {
    const input = await body();
    return sendSuccess(response, 200, requestId, business.setProfile({
      sessionId: field(input, "session_id", 64),
      name: field(input, "name", 256),
      ...(optionalString(input.description) ? { description: optionalString(input.description) as string } : {}),
      ...(optionalString(input.email) ? { email: optionalString(input.email) as string } : {}),
      ...(optionalString(input.website) ? { website: optionalString(input.website) as string } : {}),
      ...(optionalString(input.address) ? { address: optionalString(input.address) as string } : {}),
      ...(Array.isArray(input.categories) ? { categories: stringArray(input.categories, "categories") } : {})
    }));
  }
  if (url.pathname === "/api/v1/business/catalog" && method === "GET") return sendSuccess(response, 200, requestId, business.listProducts(requiredQuery(url, "session_id"), optionalQuery(url, "include_hidden") === "true"));
  if (url.pathname === "/api/v1/business/catalog" && method === "POST") {
    const input = await body();
    return sendSuccess(response, 201, requestId, business.createProduct({
      sessionId: field(input, "session_id", 64), name: field(input, "name", 256), priceMinor: requiredNumber(input.price_minor, "price_minor"), currency: field(input, "currency", 8),
      ...(optionalString(input.description) ? { description: optionalString(input.description) as string } : {}),
      ...(Array.isArray(input.image_media_ids) ? { imageMediaIds: stringArray(input.image_media_ids, "image_media_ids") } : {}),
      ...(optionalString(input.retailer_id) ? { retailerId: optionalString(input.retailer_id) as string } : {}),
      ...(optionalString(input.url) ? { url: optionalString(input.url) as string } : {})
    }));
  }
  if (segments[0] === "api" && segments[1] === "v1" && segments[2] === "business" && segments[3] === "catalog" && segments[4]) {
    if (method === "PATCH") {
      const input = await body();
      return sendSuccess(response, 200, requestId, business.updateProduct(field(input, "session_id", 64), segments[4], {
        ...(optionalString(input.name) ? { name: optionalString(input.name) as string } : {}),
        ...(optionalString(input.description) ? { description: optionalString(input.description) as string } : {}),
        ...(typeof input.price_minor === "number" ? { priceMinor: input.price_minor } : {}),
        ...(optionalString(input.currency) ? { currency: optionalString(input.currency) as string } : {}),
        ...(Array.isArray(input.image_media_ids) ? { imageMediaIds: stringArray(input.image_media_ids, "image_media_ids") } : {}),
        ...(input.retailer_id === null || typeof input.retailer_id === "string" ? { retailerId: input.retailer_id } : {}),
        ...(input.url === null || typeof input.url === "string" ? { url: input.url } : {}),
        ...(typeof input.hidden === "boolean" ? { hidden: input.hidden } : {})
      }));
    }
    if (method === "DELETE") { business.deleteProduct(requiredQuery(url, "session_id"), segments[4]); return sendEmpty(response, 204); }
  }

  if (url.pathname === "/api/v1/labels" && method === "GET") return sendSuccess(response, 200, requestId, labels.list(requiredQuery(url, "session_id")));
  if (url.pathname === "/api/v1/labels" && method === "POST") { const input = await body(); return sendSuccess(response, 201, requestId, labels.create(field(input, "session_id", 64), field(input, "name", 128), requiredNumber(input.color, "color"))); }
  if (segments[0] === "api" && segments[1] === "v1" && segments[2] === "labels" && segments[3]) {
    if (segments[4] === "assign" && method === "POST") { const input = await body(); return sendSuccess(response, 200, requestId, labels.assign(field(input, "session_id", 64), segments[3], field(input, "target_type", 16) as "chat" | "message", field(input, "target_id", 128), input.assigned !== false)); }
    if (method === "PATCH") { const input = await body(); return sendSuccess(response, 200, requestId, labels.update(field(input, "session_id", 64), segments[3], { ...(optionalString(input.name) ? { name: optionalString(input.name) as string } : {}), ...(typeof input.color === "number" ? { color: input.color } : {}) })); }
    if (method === "DELETE") { labels.delete(requiredQuery(url, "session_id"), segments[3]); return sendEmpty(response, 204); }
  }

  if (url.pathname === "/api/v1/calls" && method === "GET") return sendSuccess(response, 200, requestId, calls.list(requiredQuery(url, "session_id")));
  if (url.pathname === "/api/v1/calls/mock" && method === "POST") { const input = await body(); return sendSuccess(response, 201, requestId, calls.inject({ sessionId: field(input, "session_id", 64), peerJid: field(input, "peer_jid", 128), ...(optionalString(input.direction) ? { direction: optionalString(input.direction) as "incoming" | "outgoing" } : {}), ...(optionalString(input.kind) ? { kind: optionalString(input.kind) as "audio" | "video" } : {}) })); }
  if (segments[0] === "api" && segments[1] === "v1" && segments[2] === "calls" && segments[3] && method === "PATCH") { const input = await body(); return sendSuccess(response, 200, requestId, calls.update(field(input, "session_id", 64), segments[3], field(input, "state", 16) as "accepted" | "rejected" | "ended" | "missed")); }

  if (url.pathname === "/api/v1/privacy" && method === "GET") return sendSuccess(response, 200, requestId, privacy.get(requiredQuery(url, "session_id")));
  if (url.pathname === "/api/v1/privacy" && method === "PATCH") {
    const input = await body();
    const patch: Record<string, unknown> = { ...input }; delete patch.session_id;
    return sendSuccess(response, 200, requestId, privacy.update(field(input, "session_id", 64), {
      ...(optionalString(patch.last_seen) ? { lastSeen: optionalString(patch.last_seen) as "everyone" | "contacts" | "contacts-except" | "nobody" } : {}),
      ...(optionalString(patch.online) ? { online: optionalString(patch.online) as "everyone" | "same-as-last-seen" } : {}),
      ...(optionalString(patch.profile_photo) ? { profilePhoto: optionalString(patch.profile_photo) as "everyone" | "contacts" | "contacts-except" | "nobody" } : {}),
      ...(optionalString(patch.about) ? { about: optionalString(patch.about) as "everyone" | "contacts" | "contacts-except" | "nobody" } : {}),
      ...(optionalString(patch.status) ? { status: optionalString(patch.status) as "contacts" | "contacts-except" | "only-share-with" } : {}),
      ...(typeof patch.read_receipts === "boolean" ? { readReceipts: patch.read_receipts } : {}),
      ...(optionalString(patch.groups) ? { groups: optionalString(patch.groups) as "everyone" | "contacts" | "contacts-except" } : {}),
      ...(typeof patch.silence_unknown_calls === "boolean" ? { silenceUnknownCalls: patch.silence_unknown_calls } : {})
    }));
  }

    if (url.pathname === "/api/v1/history/snapshots" && method === "GET") return sendSuccess(response, 200, requestId, history.list(requiredQuery(url, "session_id")));
  if (url.pathname === "/api/v1/history/snapshots" && method === "POST") {
    const input = await body();
    const sessionId = field(input, "session_id", 64);
    return sendSuccess(response, 201, requestId, history.create(sessionId, {
      messages: messages.list({ sessionId }),
      chats: chats.list(sessionId),
      contacts: contacts.list(sessionId),
      groups: groups.list(sessionId),
      statuses: statuses.list(sessionId),
      channels: channels.list(sessionId),
      communities: communities.list(sessionId),
      catalog: business.listProducts(sessionId, true),
      labels: labels.list(sessionId),
      calls: calls.list(sessionId),
      privacy: [privacy.get(sessionId)]
    }));
  }
  if (url.pathname === "/api/v1/history/import" && method === "POST") {
    const input = await body();
    if (!isRecord(input.payload)) throw validation("payload history harus berupa objek");
    const payload: Record<string, unknown[]> = {};
    for (const [key, value] of Object.entries(input.payload)) {
      if (!Array.isArray(value)) throw validation(`payload.${key} harus berupa array`);
      payload[key] = value;
    }
    return sendSuccess(response, 201, requestId, history.import({ sessionId: field(input, "session_id", 64), payload }));
  }
  if (segments[0] === "api" && segments[1] === "v1" && segments[2] === "history" && segments[3] === "snapshots" && segments[4] && method === "GET") return sendSuccess(response, 200, requestId, history.get(requiredQuery(url, "session_id"), segments[4]));

  if (url.pathname === "/api/v1/webhooks" && method === "GET") return sendSuccess(response, 200, requestId, webhooks.list());
  if (url.pathname === "/api/v1/webhooks" && method === "POST") { const input = await body(); const webhook = webhooks.create({ url: field(input, "url", 2048), secret: field(input, "secret", 512), events: stringArray(input.events, "events") }); return sendSuccess(response, 201, requestId, { ...webhook, secret: "[REDACTED]" }); }
  if (segments[0] === "api" && segments[1] === "v1" && segments[2] === "webhooks" && segments[3] && method === "DELETE") { if (!webhooks.delete(segments[3])) throw new OpenSrcWaError({ code: "WEBHOOK_NOT_FOUND", category: "WEBHOOK_ERROR", message: "Webhook tidak ditemukan" }); return sendEmpty(response, 204); }
  if (url.pathname === "/api/v1/webhooks/deliveries" && method === "GET") return sendSuccess(response, 200, requestId, webhooks.history());

  throw new OpenSrcWaError({ code: "ROUTE_NOT_FOUND", category: "VALIDATION_ERROR", message: "Route tidak ditemukan", details: { method, path: url.pathname } });
}

function createStore(config: GatewayConfig): SessionStore {
  if (config.store === "sqlite") {
    const sqlite = require("../../../packages/session-store/src/sqlite-store") as { SqliteSessionStore: new (filePath: string) => SessionStore };
    return new sqlite.SqliteSessionStore(path.join(config.dataDir, "sessions.sqlite"));
  }
  return new EncryptedFileSessionStore(config.dataDir, config.sessionKey);
}
async function readJson(request: RequestLike, maxBytes: number): Promise<unknown> {
  const chunks: Uint8Array[] = []; let size = 0;
  return new Promise<unknown>((resolve, reject) => {
    request.on("data", (chunk) => { if (!chunk) return; size += chunk.byteLength; if (size > maxBytes) return reject(new OpenSrcWaError({ code: "PAYLOAD_TOO_LARGE", category: "VALIDATION_ERROR", message: "Ukuran body melebihi batas" })); chunks.push(chunk); });
    request.on("end", () => { try { const raw = Buffer.concat(chunks).toString("utf8"); resolve(raw ? JSON.parse(raw) as unknown : {}); } catch { reject(new OpenSrcWaError({ code: "INVALID_JSON", category: "VALIDATION_ERROR", message: "Body JSON tidak valid" })); } });
    request.on("error", () => reject(new OpenSrcWaError({ code: "REQUEST_STREAM_ERROR", category: "TRANSPORT_ERROR", message: "Gagal membaca request" })));
  });
}
function secureHeaders(response: ResponseLike, requestId: string): void {
  response.setHeader("X-Request-Id", requestId); response.setHeader("X-Content-Type-Options", "nosniff"); response.setHeader("X-Frame-Options", "DENY"); response.setHeader("Referrer-Policy", "no-referrer"); response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
}
function sendSuccess<T>(response: ResponseLike, status: number, requestId: string, data: T): void { const payload: ApiSuccess<T> = { success: true, data, error: null, meta: { request_id: requestId, timestamp: new Date().toISOString() } }; sendJson(response, status, payload); }
function sendFailure(response: ResponseLike, status: number, requestId: string, error: OpenSrcWaError): void { const payload: ApiFailure = { success: false, data: null, error: { code: error.code, message: error.message, details: error.details }, meta: { request_id: requestId, timestamp: new Date().toISOString() } }; sendJson(response, status, payload); }
function sendJson(response: ResponseLike, status: number, value: unknown): void { response.statusCode = status; response.setHeader("Content-Type", "application/json; charset=utf-8"); response.end(`${JSON.stringify(value)}\n`); }
function sendText(response: ResponseLike, status: number, value: string, contentType: string): void { response.statusCode = status; response.setHeader("Content-Type", contentType); response.end(value); }
function sendEmpty(response: ResponseLike, status: number): void { response.statusCode = status; response.end(); }
function header(headers: Record<string, string | string[] | undefined>, name: string): string | undefined { const value = headers[name]; return Array.isArray(value) ? value[0] : value; }
function applyCors(request: RequestLike, response: ResponseLike, allowed: string[]): void { const origin = header(request.headers, "origin"); if (origin && allowed.includes(origin)) { response.setHeader("Access-Control-Allow-Origin", origin); response.setHeader("Vary", "Origin"); response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key, Idempotency-Key"); response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS"); } }
function requiredQuery(url: URL, name: string): string { const value = url.searchParams.get(name); if (!value) throw validation(`${name} wajib diisi`); return value; }
function optionalQuery(url: URL, name: string): string | null { return url.searchParams.get(name); }
function field(input: Record<string, unknown>, name: string, max: number): string { return requireString(input[name], name, { min: 1, max }); }
function optionalString(value: unknown): string | null { return typeof value === "string" && value.length > 0 ? value : null; }
function requiredNumber(value: unknown, name: string): number { if (typeof value !== "number" || !Number.isFinite(value)) throw validation(`${name} harus berupa angka`); return value; }
function stringArray(value: unknown, name: string): string[] { if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) throw validation(`${name} harus berupa array string`); return value; }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function validation(message: string): OpenSrcWaError { return new OpenSrcWaError({ code: "VALIDATION_ERROR", category: "VALIDATION_ERROR", message }); }
function publicMessage(message: import("../../../packages/messaging/src/message-service").MessageRecord): Record<string, unknown> {
  return {
    message_id: message.messageId,
    session_id: message.sessionId,
    chat_id: message.chatId,
    from: message.from,
    to: message.to,
    type: message.type,
    text: message.text,
    content: { ...message.content },
    direction: message.direction,
    status: message.status,
    timestamp: message.timestamp,
    idempotency_key: message.idempotencyKey,
    quoted_message_id: message.quotedMessageId,
    forwarded_from: message.forwardedFrom,
    edited_at: message.editedAt,
    deleted_at: message.deletedAt,
    reactions: message.reactions.map((reaction) => ({ ...reaction })),
    receipts: message.receipts.map((receipt) => ({ ...receipt })),
    protocol_status: message.protocolStatus
  };
}
function statusFor(code: string): number {
  if (code === "UNAUTHORIZED") return 401;
  if (code === "RATE_LIMITED") return 429;
  if (code.endsWith("_NOT_FOUND") || code === "ROUTE_NOT_FOUND") return 404;
  if (["SESSION_EXISTS", "SESSION_NOT_READY", "PAIRING_NOT_AVAILABLE", "INVALID_SESSION_TRANSITION", "CONSENT_REVOKED", "RECIPIENT_BLOCKED"].includes(code)) return 409;
  if (["VALIDATION_ERROR", "INVALID_JSON", "INVALID_JSON_BODY", "INVALID_RECIPIENT", "INVALID_LOCATION", "INVALID_POLL", "MEDIA_MIME_INVALID", "MEDIA_SIZE_INVALID"].includes(code)) return 422;
  if (code === "PAYLOAD_TOO_LARGE") return 413;
  if (["LIVE_PROTOCOL_BLOCKED", "LIVE_SEND_BLOCKED"].includes(code)) return 501;
  return 500;
}

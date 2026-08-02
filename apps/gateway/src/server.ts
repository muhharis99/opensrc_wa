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
import { MessageService } from "../../../packages/messaging/src/message-service";
import { WebhookService } from "../../../packages/webhook/src/webhook-service";
import { JsonLogger, type Logger } from "../../../packages/observability/src/logger";
import { MetricsRegistry } from "../../../packages/observability/src/metrics";
import { openApiDocument } from "../../../packages/api-contract/src/openapi";
import { ApiKeyAuthenticator } from "./api-key-auth";
import { FixedWindowRateLimiter } from "./rate-limiter";
import { WebSocketEventHub } from "./websocket-hub";
import type { GatewayConfig } from "./config";

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
  webhooks: WebhookService;
  metrics: MetricsRegistry;
  websocket: WebSocketEventHub;
  close(): Promise<void>;
}

export function createGateway(config: GatewayConfig, options?: { logger?: Logger; store?: SessionStore }): GatewayRuntime {
  const logger = options?.logger ?? new JsonLogger(process.env.NODE_ENV === "development" ? "debug" : "info");
  const metrics = new MetricsRegistry();
  const store = options?.store ?? createStore(config);
  const pairing = new PairingController();
  const sessions = new SessionManager(store, pairing, config.protocolMode);
  const messages = new MessageService(sessions, config.protocolMode);
  const webhooks = new WebhookService(config.webhookTimeoutMs, config.webhookMaxRetries);
  const auth = new ApiKeyAuthenticator(config.apiKeyHash);
  const limiter = new FixedWindowRateLimiter(config.rateLimitPerMinute, 60_000);
  const websocket = new WebSocketEventHub();

  const publish = (eventName: string, event: unknown): void => {
    websocket.publish(event);
    metrics.increment(`opensrc_wa_events_total_${eventName.replaceAll(".", "_")}`);
    void webhooks.publish(eventName, event);
  };
  sessions.on("connection.update", (event) => publish("connection.update", event));
  sessions.on("pairing.qr", (event) => publish("session.qr", event));
  sessions.on("session.ready", (event) => publish("session.ready", event));
  sessions.on("logged.out", (event) => publish("session.logged_out", event));
  messages.on("message.sent", (event) => publish("message.sent", event));
  messages.on("message.ack", (event) => publish("message.ack", event));
  messages.on("message.failed", (event) => publish("message.failed", event));

  const server = http.createServer(async (request: RequestLike, response: ResponseLike) => {
    const requestId = crypto.randomUUID();
    const startedAt = Date.now();
    response.setHeader("X-Request-Id", requestId);
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    applyCors(request, response, config.corsOrigins);

    try {
      const method = request.method ?? "GET";
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
      if (method === "OPTIONS") return sendEmpty(response, 204);
      if (method === "GET" && url.pathname === "/health") return sendSuccess(response, 200, requestId, { status: "ok", uptime_seconds: Math.floor(process.uptime()) });
      if (method === "GET" && url.pathname === "/ready") return sendSuccess(response, 200, requestId, { ready: true, protocol_mode: config.protocolMode, live_protocol: "BLOCKED" });
      if (method === "GET" && url.pathname === "/version") return sendSuccess(response, 200, requestId, { name: "opensrc_wa", version: "0.1.0", protocol_status: "BLOCKED" });
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
      await route({ request, response, method, url, requestId, config, sessions, messages, webhooks });
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

  return { server, sessions, messages, webhooks, metrics, websocket, close };
}

async function route(context: {
  request: RequestLike;
  response: ResponseLike;
  method: string;
  url: URL;
  requestId: string;
  config: GatewayConfig;
  sessions: SessionManager;
  messages: MessageService;
  webhooks: WebhookService;
}): Promise<void> {
  const { request, response, method, url, requestId, config, sessions, messages, webhooks } = context;
  const segments = url.pathname.split("/").filter(Boolean);

  if (url.pathname === "/api/v1/sessions" && method === "GET") return sendSuccess(response, 200, requestId, await sessions.list());
  if (url.pathname === "/api/v1/sessions" && method === "POST") {
    const body = requireRecord(await readJson(request, config.maxBodyBytes));
    const sessionId = requireString(body.session_id, "session_id", { min: 1, max: 64 });
    if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) throw new OpenSrcWaError({ code: "VALIDATION_ERROR", category: "VALIDATION_ERROR", message: "session_id hanya boleh berisi huruf, angka, _ dan -" });
    return sendSuccess(response, 201, requestId, await sessions.create(sessionId));
  }

  if (segments[0] === "api" && segments[1] === "v1" && segments[2] === "sessions" && segments[3]) {
    const sessionId = decodeURIComponent(segments[3]);
    const action = segments[4];
    if (!action && method === "GET") return sendSuccess(response, 200, requestId, await sessions.get(sessionId));
    if (!action && method === "DELETE") { await sessions.delete(sessionId); return sendEmpty(response, 204); }
    if (action === "connect" && method === "POST") return sendSuccess(response, 200, requestId, await sessions.connect(sessionId));
    if (action === "disconnect" && method === "POST") return sendSuccess(response, 200, requestId, await sessions.disconnect(sessionId));
    if (action === "logout" && method === "POST") return sendSuccess(response, 200, requestId, await sessions.logout(sessionId));
    if (action === "status" && method === "GET") return sendSuccess(response, 200, requestId, await sessions.get(sessionId));
    if (action === "qr" && method === "GET") {
      const challenge = sessions.getPairing(sessionId);
      if (!challenge) throw new OpenSrcWaError({ code: "PAIRING_NOT_AVAILABLE", category: "PAIRING_ERROR", message: "QR pairing tidak tersedia atau sudah kedaluwarsa" });
      return sendSuccess(response, 200, requestId, challenge);
    }
    if (action === "mock-complete-pairing" && method === "POST") return sendSuccess(response, 200, requestId, await sessions.completeMockPairing(sessionId));
  }

  if (url.pathname === "/api/v1/messages/text" && method === "POST") {
    const body = requireRecord(await readJson(request, config.maxBodyBytes));
    const message = await messages.sendText({
      sessionId: requireString(body.session_id, "session_id", { max: 64 }),
      to: requireString(body.to, "to", { min: 8, max: 16 }),
      text: requireString(body.text, "text", { min: 1, max: 4096 }),
      idempotencyKey: requireString(body.idempotency_key, "idempotency_key", { min: 8, max: 128 })
    });
    return sendSuccess(response, 202, requestId, sanitizeMessage(message));
  }

  if (segments[0] === "api" && segments[1] === "v1" && segments[2] === "messages" && segments[3] && method === "GET") {
    const message = messages.get(segments[3]);
    if (!message) throw new OpenSrcWaError({ code: "MESSAGE_NOT_FOUND", category: "MESSAGE_ERROR", message: "Pesan tidak ditemukan" });
    return sendSuccess(response, 200, requestId, sanitizeMessage(message));
  }

  if (url.pathname === "/api/v1/webhooks" && method === "GET") return sendSuccess(response, 200, requestId, webhooks.list());
  if (url.pathname === "/api/v1/webhooks" && method === "POST") {
    const body = requireRecord(await readJson(request, config.maxBodyBytes));
    const eventsValue = body.events;
    if (!Array.isArray(eventsValue) || !eventsValue.every((item) => typeof item === "string")) throw new OpenSrcWaError({ code: "VALIDATION_ERROR", category: "VALIDATION_ERROR", message: "events harus berupa array string" });
    const webhook = webhooks.create({
      url: requireString(body.url, "url", { max: 2048 }),
      secret: requireString(body.secret, "secret", { min: 16, max: 512 }),
      events: eventsValue
    });
    return sendSuccess(response, 201, requestId, { ...webhook, secret: "[REDACTED]" });
  }
  if (segments[0] === "api" && segments[1] === "v1" && segments[2] === "webhooks" && segments[3] && method === "DELETE") {
    if (!webhooks.delete(segments[3])) throw new OpenSrcWaError({ code: "WEBHOOK_NOT_FOUND", category: "WEBHOOK_ERROR", message: "Webhook tidak ditemukan" });
    return sendEmpty(response, 204);
  }
  if (url.pathname === "/api/v1/webhooks/deliveries" && method === "GET") return sendSuccess(response, 200, requestId, webhooks.history());

  throw new OpenSrcWaError({ code: "ROUTE_NOT_FOUND", category: "VALIDATION_ERROR", message: "Route tidak ditemukan", details: { method, path: url.pathname } });
}

function createStore(config: GatewayConfig): SessionStore {
  if (config.store === "sqlite") {
    const sqlite = require("../../../packages/session-store/src/sqlite-store") as {
      SqliteSessionStore: new (filePath: string) => SessionStore;
    };
    return new sqlite.SqliteSessionStore(path.join(config.dataDir, "sessions.sqlite"));
  }
  return new EncryptedFileSessionStore(config.dataDir, config.sessionKey);
}

async function readJson(request: RequestLike, maxBytes: number): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  return new Promise<unknown>((resolve, reject) => {
    request.on("data", (chunk) => {
      if (!chunk) return;
      size += chunk.byteLength;
      if (size > maxBytes) return reject(new OpenSrcWaError({ code: "PAYLOAD_TOO_LARGE", category: "VALIDATION_ERROR", message: "Ukuran body melebihi batas" }));
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) as unknown : {});
      } catch { reject(new OpenSrcWaError({ code: "INVALID_JSON", category: "VALIDATION_ERROR", message: "Body JSON tidak valid" })); }
    });
    request.on("error", () => reject(new OpenSrcWaError({ code: "REQUEST_STREAM_ERROR", category: "TRANSPORT_ERROR", message: "Gagal membaca request" })));
  });
}

function sanitizeMessage(message: { messageId: string; sessionId: string; to: string; direction: string; status: string; timestamp: string; idempotencyKey: string }): Record<string, unknown> {
  return { message_id: message.messageId, session_id: message.sessionId, to: message.to, direction: message.direction, status: message.status, timestamp: message.timestamp, idempotency_key: message.idempotencyKey };
}

function sendSuccess<T>(response: ResponseLike, status: number, requestId: string, data: T): void {
  const payload: ApiSuccess<T> = { success: true, data, error: null, meta: { request_id: requestId, timestamp: new Date().toISOString() } };
  sendJson(response, status, payload);
}

function sendFailure(response: ResponseLike, status: number, requestId: string, error: OpenSrcWaError): void {
  const payload: ApiFailure = { success: false, data: null, error: { code: error.code, message: error.message, details: error.details }, meta: { request_id: requestId, timestamp: new Date().toISOString() } };
  sendJson(response, status, payload);
}

function sendJson(response: ResponseLike, status: number, value: unknown): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(`${JSON.stringify(value)}\n`);
}

function sendText(response: ResponseLike, status: number, value: string, contentType: string): void {
  response.statusCode = status;
  response.setHeader("Content-Type", contentType);
  response.end(value);
}

function sendEmpty(response: ResponseLike, status: number): void {
  response.statusCode = status;
  response.end();
}

function header(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function applyCors(request: RequestLike, response: ResponseLike, allowed: string[]): void {
  const origin = header(request.headers, "origin");
  if (origin && allowed.includes(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key, Idempotency-Key");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  }
}

function statusFor(code: string): number {
  if (code === "UNAUTHORIZED") return 401;
  if (code === "RATE_LIMITED") return 429;
  if (code.endsWith("_NOT_FOUND") || code === "ROUTE_NOT_FOUND") return 404;
  if (code === "SESSION_EXISTS") return 409;
  if (["VALIDATION_ERROR", "INVALID_JSON", "INVALID_JSON_BODY", "INVALID_RECIPIENT"].includes(code)) return 422;
  if (code === "PAYLOAD_TOO_LARGE") return 413;
  if (["LIVE_PROTOCOL_BLOCKED", "LIVE_SEND_BLOCKED"].includes(code)) return 501;
  if (["SESSION_NOT_READY", "PAIRING_NOT_AVAILABLE", "INVALID_SESSION_TRANSITION"].includes(code)) return 409;
  return 500;
}

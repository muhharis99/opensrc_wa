import path = require("node:path");

export interface LiveGatewayConfig {
  host: string;
  port: number;
  apiKeyHash: string;
  authRootDir: string;
  rateLimitPerMinute: number;
  maxBodyBytes: number;
  webhookUrl: string | null;
  webhookSecret: string | null;
  webhookTimeoutMs: number;
  webhookMaxRetries: number;
}

export function loadLiveGatewayConfig(env: Record<string, string | undefined> = process.env): LiveGatewayConfig {
  const apiKeyHash = env.OPEN_SRC_WA_API_KEY_SHA256 ?? "";
  if (!/^[a-f0-9]{64}$/i.test(apiKeyHash)) throw new Error("OPEN_SRC_WA_API_KEY_SHA256 must be a 64-character SHA-256 hex digest");
  const webhookUrl = clean(env.OPEN_SRC_WA_LIVE_WEBHOOK_URL);
  const webhookSecret = clean(env.OPEN_SRC_WA_LIVE_WEBHOOK_SECRET);
  if ((webhookUrl && !webhookSecret) || (!webhookUrl && webhookSecret)) throw new Error("Live webhook URL and secret must be configured together");
  if (webhookUrl && !/^https?:\/\//i.test(webhookUrl)) throw new Error("OPEN_SRC_WA_LIVE_WEBHOOK_URL must use http or https");
  if (webhookSecret && webhookSecret.length < 24) throw new Error("OPEN_SRC_WA_LIVE_WEBHOOK_SECRET must contain at least 24 characters");
  return {
    host: env.LIVE_HOST ?? env.HOST ?? "0.0.0.0",
    port: parseInteger(env.LIVE_PORT, 3001, 1, 65_535),
    apiKeyHash: apiKeyHash.toLowerCase(),
    authRootDir: path.resolve(env.OPEN_SRC_WA_BAILEYS_AUTH_DIR ?? "./runtime/baileys-auth"),
    rateLimitPerMinute: parseInteger(env.OPEN_SRC_WA_LIVE_RATE_LIMIT_PER_MINUTE, 60, 1, 10_000),
    maxBodyBytes: parseInteger(env.OPEN_SRC_WA_MAX_BODY_BYTES, 10_485_760, 1_024, 52_428_800),
    webhookUrl,
    webhookSecret,
    webhookTimeoutMs: parseInteger(env.OPEN_SRC_WA_WEBHOOK_TIMEOUT_MS, 5_000, 100, 60_000),
    webhookMaxRetries: parseInteger(env.OPEN_SRC_WA_WEBHOOK_MAX_RETRIES, 4, 1, 10)
  };
}

function clean(value: string | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized ? normalized : null;
}

function parseInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = value === undefined ? fallback : Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new Error(`Invalid numeric configuration: ${value ?? fallback}`);
  return parsed;
}

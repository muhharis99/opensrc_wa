import path = require("node:path");

export interface GatewayConfig {
  host: string;
  port: number;
  apiKeyHash: string;
  sessionKey: Uint8Array;
  store: "encrypted-file" | "sqlite";
  dataDir: string;
  protocolMode: "mock" | "research";
  corsOrigins: string[];
  rateLimitPerMinute: number;
  maxBodyBytes: number;
  webhookTimeoutMs: number;
  webhookMaxRetries: number;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): GatewayConfig {
  const apiKeyHash = env.OPEN_SRC_WA_API_KEY_SHA256 ?? "";
  if (!/^[a-f0-9]{64}$/i.test(apiKeyHash)) throw new Error("OPEN_SRC_WA_API_KEY_SHA256 must be a 64-character SHA-256 hex digest");
  const sessionKeyHex = env.OPEN_SRC_WA_SESSION_KEY ?? "";
  if (!/^[a-f0-9]{64}$/i.test(sessionKeyHex)) throw new Error("OPEN_SRC_WA_SESSION_KEY must be 64 hex characters");
  const store = env.OPEN_SRC_WA_STORE === "sqlite" ? "sqlite" : "encrypted-file";
  const protocolMode = env.OPEN_SRC_WA_PROTOCOL_MODE === "research" ? "research" : "mock";
  return {
    host: env.HOST ?? "0.0.0.0",
    port: parseInteger(env.PORT, 3000, 1, 65_535),
    apiKeyHash: apiKeyHash.toLowerCase(),
    sessionKey: new Uint8Array(Buffer.from(sessionKeyHex, "hex")),
    store,
    dataDir: path.resolve(env.OPEN_SRC_WA_DATA_DIR ?? "./runtime"),
    protocolMode,
    corsOrigins: (env.OPEN_SRC_WA_CORS_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean),
    rateLimitPerMinute: parseInteger(env.OPEN_SRC_WA_RATE_LIMIT_PER_MINUTE, 120, 1, 100_000),
    maxBodyBytes: parseInteger(env.OPEN_SRC_WA_MAX_BODY_BYTES, 262_144, 1_024, 10_485_760),
    webhookTimeoutMs: parseInteger(env.OPEN_SRC_WA_WEBHOOK_TIMEOUT_MS, 5_000, 100, 60_000),
    webhookMaxRetries: parseInteger(env.OPEN_SRC_WA_WEBHOOK_MAX_RETRIES, 4, 1, 10)
  };
}

function parseInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = value === undefined ? fallback : Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new Error(`Invalid numeric configuration: ${value ?? fallback}`);
  return parsed;
}

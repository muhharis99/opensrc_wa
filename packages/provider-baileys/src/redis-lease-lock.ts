import crypto = require("node:crypto");
import net = require("node:net");
import tls = require("node:tls");
import type { SessionLeaseHandle, SessionLeaseLock } from "../../provider-contract/src/lease-lock";

export interface RedisCommandClient {
  command(args: string[]): Promise<unknown>;
  close(): Promise<void>;
}

export interface RedisSessionLeaseLockOptions {
  url: string;
  keyPrefix?: string;
  connectTimeoutMs?: number;
  commandClientFactory?: (url: string, timeoutMs: number) => RedisCommandClient;
}

const RENEW_SCRIPT = "if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('pexpire',KEYS[1],ARGV[2]) else return 0 end";
const RELEASE_SCRIPT = "if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end";

export class RedisSessionLeaseLock implements SessionLeaseLock {
  private readonly keyPrefix: string;
  private readonly connectTimeoutMs: number;
  private readonly commandClientFactory: (url: string, timeoutMs: number) => RedisCommandClient;

  public constructor(private readonly options: RedisSessionLeaseLockOptions) {
    const parsed = new URL(options.url);
    if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") throw new Error("Redis lease URL harus menggunakan redis:// atau rediss://");
    this.keyPrefix = options.keyPrefix ?? "opensrc_wa:session-lease:";
    this.connectTimeoutMs = options.connectTimeoutMs ?? 5_000;
    this.commandClientFactory = options.commandClientFactory ?? ((url, timeout) => new RedisSocketClient(url, timeout));
  }

  public async acquire(sessionId: string, ttlMs: number): Promise<SessionLeaseHandle> {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(sessionId)) throw new Error("session_id tidak valid");
    if (!Number.isInteger(ttlMs) || ttlMs < 5_000) throw new Error("ttlMs minimal 5000");
    const ownerId = crypto.randomUUID();
    const key = `${this.keyPrefix}${sessionId}`;
    const client = this.commandClientFactory(this.options.url, this.connectTimeoutMs);
    try {
      const acquired = await client.command(["SET", key, ownerId, "NX", "PX", String(ttlMs)]);
      if (acquired !== "OK") {
        await client.close();
        throw new Error(`SESSION_LOCKED:${sessionId}`);
      }
    } catch (error) {
      await client.close().catch(() => undefined);
      throw error;
    }

    let released = false;
    return {
      sessionId,
      ownerId,
      renew: async () => {
        if (released) throw new Error("SESSION_LEASE_RELEASED");
        const result = await client.command(["EVAL", RENEW_SCRIPT, "1", key, ownerId, String(ttlMs)]);
        if (Number(result) !== 1) throw new Error(`SESSION_LEASE_LOST:${sessionId}`);
      },
      release: async () => {
        if (released) return;
        released = true;
        try {
          await client.command(["EVAL", RELEASE_SCRIPT, "1", key, ownerId]);
        } finally {
          await client.close();
        }
      }
    };
  }
}

class RedisSocketClient implements RedisCommandClient {
  private socket: any = null;
  private buffer = Buffer.alloc(0);
  private readonly pending: Array<{ resolve: (value: unknown) => void; reject: (error: Error) => void }> = [];
  private connectPromise: Promise<void> | null = null;
  private chain: Promise<unknown> = Promise.resolve();
  private authenticated = false;

  public constructor(private readonly url: string, private readonly timeoutMs: number) {}

  public command(args: string[]): Promise<unknown> {
    const next = this.chain.catch(() => undefined).then(async () => {
      await this.connect();
      return this.send(args);
    });
    this.chain = next;
    return next;
  }

  public async close(): Promise<void> {
    const socket = this.socket;
    this.socket = null;
    this.connectPromise = null;
    this.authenticated = false;
    if (!socket) return;
    await new Promise<void>((resolve) => {
      socket.once("close", resolve);
      socket.end();
      const timer = setTimeout(() => { socket.destroy(); resolve(); }, 1_000);
      (timer as unknown as { unref?: () => void }).unref?.();
    });
  }

  private async connect(): Promise<void> {
    if (this.socket && !this.socket.destroyed && this.authenticated) return;
    if (this.connectPromise) return this.connectPromise;
    this.connectPromise = this.open();
    try { await this.connectPromise; } finally { this.connectPromise = null; }
  }

  private async open(): Promise<void> {
    const parsed = new URL(this.url);
    const secure = parsed.protocol === "rediss:";
    const port = Number(parsed.port || (secure ? 6380 : 6379));
    const options = { host: parsed.hostname, port, servername: parsed.hostname };
    const socket = secure ? tls.connect(options) : net.createConnection(options);
    this.socket = socket;
    socket.setTimeout(this.timeoutMs);
    socket.on("data", (chunk: Uint8Array) => this.onData(chunk));
    socket.on("error", (error: Error) => this.failAll(error));
    socket.on("timeout", () => socket.destroy(new Error("Redis connection timeout")));
    socket.on("close", () => {
      if (this.socket === socket) this.socket = null;
      this.authenticated = false;
      this.failAll(new Error("Redis connection closed"));
    });
    await new Promise<void>((resolve, reject) => {
      const event = secure ? "secureConnect" : "connect";
      const onReady = () => { cleanup(); resolve(); };
      const onError = (error: Error) => { cleanup(); reject(error); };
      const cleanup = () => { socket.off(event, onReady); socket.off("error", onError); };
      socket.once(event, onReady);
      socket.once("error", onError);
    });

    const username = parsed.username ? decodeURIComponent(parsed.username) : "";
    const password = parsed.password ? decodeURIComponent(parsed.password) : "";
    if (password) await this.send(username ? ["AUTH", username, password] : ["AUTH", password]);
    const database = parsed.pathname.replace(/^\//, "");
    if (database && database !== "0") await this.send(["SELECT", database]);
    this.authenticated = true;
  }

  private send(args: string[]): Promise<unknown> {
    if (!this.socket) return Promise.reject(new Error("Redis socket belum terhubung"));
    return new Promise((resolve, reject) => {
      this.pending.push({ resolve, reject });
      this.socket.write(encodeResp(args));
    });
  }

  private onData(chunk: Uint8Array): void {
    this.buffer = Buffer.concat([this.buffer, Buffer.from(chunk)]);
    while (this.pending.length > 0) {
      const parsed = parseResp(this.buffer, 0);
      if (!parsed) return;
      this.buffer = this.buffer.subarray(parsed.offset);
      const pending = this.pending.shift();
      if (!pending) return;
      if (parsed.value instanceof Error) pending.reject(parsed.value);
      else pending.resolve(parsed.value);
    }
  }

  private failAll(error: Error): void {
    for (const pending of this.pending.splice(0)) pending.reject(error);
  }
}

function encodeResp(args: string[]): string {
  let output = `*${args.length}\r\n`;
  for (const value of args) {
    const size = Buffer.byteLength(value);
    output += `$${size}\r\n${value}\r\n`;
  }
  return output;
}

function parseResp(buffer: any, start: number): { value: unknown; offset: number } | null {
  if (start >= buffer.length) return null;
  const prefix = String.fromCharCode(buffer[start]);
  const lineEnd = buffer.indexOf("\r\n", start + 1);
  if (lineEnd < 0) return null;
  const header = buffer.subarray(start + 1, lineEnd).toString("utf8");
  const next = lineEnd + 2;
  if (prefix === "+") return { value: header, offset: next };
  if (prefix === "-") return { value: new Error(`Redis error: ${header}`), offset: next };
  if (prefix === ":") return { value: Number(header), offset: next };
  if (prefix === "$") {
    const length = Number(header);
    if (length === -1) return { value: null, offset: next };
    if (buffer.length < next + length + 2) return null;
    return { value: buffer.subarray(next, next + length).toString("utf8"), offset: next + length + 2 };
  }
  if (prefix === "*") {
    const length = Number(header);
    if (length === -1) return { value: null, offset: next };
    const values: unknown[] = [];
    let offset = next;
    for (let index = 0; index < length; index += 1) {
      const child = parseResp(buffer, offset);
      if (!child) return null;
      values.push(child.value);
      offset = child.offset;
    }
    return { value: values, offset };
  }
  return { value: new Error(`Redis protocol prefix tidak didukung: ${prefix}`), offset: next };
}

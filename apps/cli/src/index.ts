interface CliConfig { baseUrl: string; apiKey: string; }

async function main(): Promise<void> {
  const config: CliConfig = { baseUrl: process.env.OPEN_SRC_WA_URL ?? "http://localhost:3000", apiKey: process.env.OPEN_SRC_WA_API_KEY ?? "" };
  if (!config.apiKey) fail("OPEN_SRC_WA_API_KEY wajib diatur untuk CLI");
  const [command, argument, ...rest] = process.argv.slice(2);
  if (!command) return help();
  const options = parseFlags([argument, ...rest].filter((value): value is string => typeof value === "string"));

  if (command === "capabilities") return print(await request(config, "GET", "/api/v1/capabilities"));
  if (command === "session:create") return print(await request(config, "POST", "/api/v1/sessions", { session_id: required(argument, "session id") }));
  if (command === "session:connect") return print(await request(config, "POST", sessionPath(argument, "connect")));
  if (command === "session:status") return print(await request(config, "GET", sessionPath(argument, "status")));
  if (command === "session:qr") return print(await request(config, "GET", sessionPath(argument, "qr")));
  if (command === "session:pairing-code") return print(await request(config, "POST", sessionPath(argument, "pairing-code"), { phone: required(options.phone, "--phone") }));
  if (command === "session:mock-complete-pairing") return print(await request(config, "POST", sessionPath(argument, "mock-complete-pairing")));
  if (command === "session:logout") return print(await request(config, "POST", sessionPath(argument, "logout")));

  if (command === "message:send") return print(await request(config, "POST", "/api/v1/messages/text", { session_id: required(options.session, "--session"), to: required(options.to, "--to"), text: required(options.text, "--text"), idempotency_key: options.idempotency ?? `cli-${Date.now()}`, ...(options.quote ? { quoted_message_id: options.quote } : {}) }));
  if (command === "message:send-location") return print(await request(config, "POST", "/api/v1/messages/location", { session_id: required(options.session, "--session"), to: required(options.to, "--to"), latitude: Number(required(options.latitude, "--latitude")), longitude: Number(required(options.longitude, "--longitude")), idempotency_key: options.idempotency ?? `cli-${Date.now()}` }));
  if (command === "message:list") return print(await request(config, "GET", withQuery("/api/v1/messages", { session_id: options.session, chat_id: options.chat, q: options.query })));
  if (command === "message:react") return print(await request(config, "POST", `/api/v1/messages/${encodeURIComponent(required(argument, "message id"))}/reactions`, { session_id: required(options.session, "--session"), jid: required(options.jid, "--jid"), emoji: required(options.emoji, "--emoji") }));

  if (command === "media:list") return print(await request(config, "GET", withQuery("/api/v1/media", { session_id: required(options.session, "--session") })));
  if (command === "contact:list") return print(await request(config, "GET", withQuery("/api/v1/contacts", { session_id: required(options.session, "--session") })));
  if (command === "contact:consent") return print(await request(config, "POST", `/api/v1/contacts/${encodeURIComponent(required(argument, "phone"))}/consent`, { session_id: required(options.session, "--session"), basis: required(options.basis, "--basis") }));
  if (command === "chat:list") return print(await request(config, "GET", withQuery("/api/v1/chats", { session_id: required(options.session, "--session"), q: options.query })));
  if (command === "group:list") return print(await request(config, "GET", withQuery("/api/v1/groups", { session_id: required(options.session, "--session") })));
  if (command === "group:create") return print(await request(config, "POST", "/api/v1/groups", { session_id: required(options.session, "--session"), subject: required(options.subject, "--subject"), participants: options.participants?.split(",").filter(Boolean) ?? [] }));
  if (command === "presence:set") return print(await request(config, "POST", "/api/v1/presence", { session_id: required(options.session, "--session"), jid: required(options.jid, "--jid"), state: required(options.state, "--state") }));
  if (command === "status:list") return print(await request(config, "GET", withQuery("/api/v1/statuses", { session_id: required(options.session, "--session") })));
  if (command === "channel:list") return print(await request(config, "GET", withQuery("/api/v1/channels", { session_id: required(options.session, "--session") })));
  if (command === "community:list") return print(await request(config, "GET", withQuery("/api/v1/communities", { session_id: required(options.session, "--session") })));
  fail(`Perintah tidak dikenal: ${command}`);
}

async function request(config: CliConfig, method: string, path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(`${config.baseUrl}${path}`, { method, headers: { "X-API-Key": config.apiKey, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const text = await response.text();
  const value = text ? JSON.parse(text) as unknown : null;
  if (!response.ok) { process.stderr.write(`${JSON.stringify(value, null, 2)}\n`); process.exit(1); }
  return value;
}
function sessionPath(sessionId: string | undefined, action: string): string { return `/api/v1/sessions/${encodeURIComponent(required(sessionId, "session id"))}/${action}`; }
function withQuery(path: string, values: Record<string, string | undefined>): string { const query = new URLSearchParams(); for (const [key, value] of Object.entries(values)) if (value) query.set(key, value); const suffix = query.toString(); return suffix ? `${path}?${suffix}` : path; }
function parseFlags(args: string[]): Record<string, string> { const output: Record<string, string> = {}; for (let index = 0; index < args.length; index += 2) { const key = args[index]; const value = args[index + 1]; if (!key?.startsWith("--") || value === undefined) fail("Flag harus menggunakan format --nama nilai"); output[key.slice(2)] = value; } return output; }
function required(value: string | undefined, label: string): string { if (!value) fail(`${label} wajib diisi`); return value; }
function print(value: unknown): void { process.stdout.write(`${JSON.stringify(value, null, 2)}\n`); }
function fail(message: string): never { process.stderr.write(`${message}\n`); process.exit(1); throw new Error(message); }
function help(): void {
  process.stdout.write(`opensrc-wa commands:\n  capabilities\n  session:create <id>\n  session:connect <id>\n  session:status <id>\n  session:qr <id>\n  session:pairing-code <id> --phone 628...\n  session:mock-complete-pairing <id>\n  session:logout <id>\n  message:send --session <id> --to <number|jid> --text <text>\n  message:send-location --session <id> --to <number|jid> --latitude <n> --longitude <n>\n  message:list --session <id> [--chat <jid>] [--query <text>]\n  message:react <message-id> --session <id> --jid <jid> --emoji <emoji>\n  media:list --session <id>\n  contact:list --session <id>\n  contact:consent <phone> --session <id> --basis <reason>\n  chat:list --session <id>\n  group:list --session <id>\n  group:create --session <id> --subject <name> [--participants <jid,jid>]\n  presence:set --session <id> --jid <jid> --state <state>\n  status:list --session <id>\n  channel:list --session <id>\n  community:list --session <id>\n`);
}
void main();

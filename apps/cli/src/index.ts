interface CliConfig {
  baseUrl: string;
  apiKey: string;
}

async function main(): Promise<void> {
  const config: CliConfig = {
    baseUrl: process.env.OPEN_SRC_WA_URL ?? "http://localhost:3000",
    apiKey: process.env.OPEN_SRC_WA_API_KEY ?? ""
  };
  if (!config.apiKey) fail("OPEN_SRC_WA_API_KEY wajib diatur untuk CLI");
  const [command, argument, ...rest] = process.argv.slice(2);
  if (!command) return help();

  if (command === "session:create") return print(await request(config, "POST", "/api/v1/sessions", { session_id: required(argument, "session id") }));
  if (command === "session:connect") return print(await request(config, "POST", `/api/v1/sessions/${encodeURIComponent(required(argument, "session id"))}/connect`));
  if (command === "session:status") return print(await request(config, "GET", `/api/v1/sessions/${encodeURIComponent(required(argument, "session id"))}/status`));
  if (command === "session:qr") return print(await request(config, "GET", `/api/v1/sessions/${encodeURIComponent(required(argument, "session id"))}/qr`));
  if (command === "session:logout") return print(await request(config, "POST", `/api/v1/sessions/${encodeURIComponent(required(argument, "session id"))}/logout`));
  if (command === "session:mock-complete-pairing") return print(await request(config, "POST", `/api/v1/sessions/${encodeURIComponent(required(argument, "session id"))}/mock-complete-pairing`));
  if (command === "message:send") {
    const options = parseFlags([argument, ...rest].filter((value): value is string => typeof value === "string"));
    return print(await request(config, "POST", "/api/v1/messages/text", {
      session_id: required(options.session, "--session"),
      to: required(options.to, "--to"),
      text: required(options.text, "--text"),
      idempotency_key: options.idempotency ?? `cli-${Date.now()}`
    }));
  }
  fail(`Perintah tidak dikenal: ${command}`);
}

async function request(config: CliConfig, method: string, path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers: { "X-API-Key": config.apiKey, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const text = await response.text();
  const value = text ? JSON.parse(text) as unknown : null;
  if (!response.ok) {
    process.stderr.write(`${JSON.stringify(value, null, 2)}\n`);
    process.exit(1);
  }
  return value;
}

function parseFlags(args: string[]): Record<string, string> {
  const output: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || value === undefined) fail("Flag harus menggunakan format --nama nilai");
    output[key.slice(2)] = value;
  }
  return output;
}

function required(value: string | undefined, label: string): string {
  if (!value) fail(`${label} wajib diisi`);
  return value;
}

function print(value: unknown): void { process.stdout.write(`${JSON.stringify(value, null, 2)}\n`); }
function fail(message: string): never { process.stderr.write(`${message}\n`); process.exit(1); throw new Error(message); }
function help(): void {
  process.stdout.write(`opensrc-wa commands:\n  session:create <id>\n  session:connect <id>\n  session:status <id>\n  session:qr <id>\n  session:mock-complete-pairing <id>\n  message:send --session <id> --to <number> --text <text> [--idempotency <key>]\n  session:logout <id>\n`);
}

void main();

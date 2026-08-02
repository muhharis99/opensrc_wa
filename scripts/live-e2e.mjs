import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

if (process.env.ENABLE_LIVE_E2E !== "true") {
  throw new Error("Live E2E dinonaktifkan. Set ENABLE_LIVE_E2E=true hanya untuk akun dan perangkat milik sendiri.");
}

const baseUrl = (process.env.LIVE_E2E_BASE_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
const apiKey = required("LIVE_E2E_API_KEY");
const sessionId = process.env.LIVE_E2E_SESSION_ID ?? "live-e2e";
const recipient = required("LIVE_E2E_RECIPIENT");
const phone = process.env.LIVE_E2E_PAIRING_PHONE?.trim() || null;
const timeoutMs = Number.parseInt(process.env.LIVE_E2E_TIMEOUT_MS ?? "180000", 10);
const token = `opensrc_wa-live-e2e-${Date.now()}`;

await request(`/api/v1/live/sessions/${encodeURIComponent(sessionId)}/connect`, {
  method: "POST",
  body: JSON.stringify(phone ? { phone } : {})
});

const deadline = Date.now() + timeoutMs;
let connected = false;
while (Date.now() < deadline) {
  const session = await request(`/api/v1/live/sessions/${encodeURIComponent(sessionId)}`);
  if (session.qr_data_url) {
    await saveQr(session.qr_data_url);
    process.stdout.write("QR live tersedia di runtime/live-e2e-qr.png. Scan menggunakan perangkat WhatsApp milik Anda.\n");
  }
  if (session.pairingCode) process.stdout.write(`Pairing code: ${session.pairingCode}\n`);
  if (session.state === "connected") { connected = true; break; }
  if (["logged_out", "conflict", "error"].includes(session.state)) throw new Error(`Session gagal: ${JSON.stringify(session)}`);
  await delay(2_000);
}
if (!connected) throw new Error(`Timeout menunggu session '${sessionId}' terhubung`);

const result = await request(`/api/v1/live/sessions/${encodeURIComponent(sessionId)}/messages`, {
  method: "POST",
  body: JSON.stringify({ kind: "text", to: recipient, text: token })
});

process.stdout.write(`${JSON.stringify({ status: "LIVE_SEND_PASSED", sessionId, recipient, token, result }, null, 2)}\n`);
process.stdout.write("Penerimaan pesan harus diverifikasi melalui webhook atau balasan manual; harness tidak mengklaim receive E2E tanpa bukti tersebut.\n");

async function request(endpoint, options = {}) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: { "X-API-Key": apiKey, "Content-Type": "application/json", ...(options.headers ?? {}) }
  });
  const payload = await response.json();
  if (!response.ok || payload.success === false) throw new Error(payload.error?.message ?? `HTTP ${response.status}`);
  return payload.data;
}

async function saveQr(dataUrl) {
  const match = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
  if (!match) return;
  const runtime = path.resolve("runtime");
  await mkdir(runtime, { recursive: true, mode: 0o700 });
  await writeFile(path.join(runtime, "live-e2e-qr.png"), Buffer.from(match[1], "base64"), { mode: 0o600 });
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} wajib diisi`);
  return value;
}

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

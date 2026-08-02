# opensrc_wa

`opensrc_wa` adalah fondasi open-source mandiri untuk penelitian interoperabilitas konektivitas perangkat berbasis mekanisme WhatsApp Web/Multi-Device dengan pendekatan **clean-room implementation**.

> **Status protokol live: `BLOCKED`.** Repository ini telah memiliki arsitektur, gateway, CLI, session store, keamanan API, webhook, pengujian, Docker, dan runtime mock yang dapat dijalankan. Repository ini **belum** mengklaim dapat pairing atau mengirim/menerima pesan WhatsApp secara live.

`opensrc_wa` adalah proyek independen dan tidak berafiliasi, tidak disponsori, serta tidak didukung oleh WhatsApp atau Meta.

## Prinsip utama

- Tidak menggunakan Baileys, Venom Bot, `whatsapp-web.js`, WPPConnect, open-wa, fork, wrapper, atau gateway WhatsApp siap pakai.
- Tidak menggunakan Chromium, Puppeteer, Playwright, Selenium, atau browser automation sebagai konektor.
- Tidak mengarang endpoint, schema, key, constant, QR, atau bukti koneksi live.
- Primitive kriptografi menggunakan implementasi bawaan Node.js/OpenSSL; proyek hanya mengatur lifecycle dan orchestration.
- Mode default adalah `mock` untuk pengembangan API, persistence, webhook, dan integrasi tanpa menyentuh akun nyata.

## Fitur yang telah tersedia

- Monorepo TypeScript strict untuk gateway, CLI, core, transport, protocol, crypto, auth, session store, messaging, webhook, observability, dan testkit.
- State machine session lengkap dari `DISCONNECTED` hingga `READY`, `LOGGED_OUT`, dan `ERROR`.
- Transport abstraction, mock transport, generic native WebSocket transport, retry eksponensial, dan jitter.
- Length-prefixed frame codec, binary-node research codec, request correlation, malformed-frame protection, dan batas ukuran.
- AES-256-GCM encrypted file session store dengan atomic write.
- SQLite adapter menggunakan `node:sqlite`; contract adapter tersedia untuk MySQL, MariaDB, dan PostgreSQL.
- REST API, OpenAPI JSON, WebSocket event stream, CLI, API-key authentication, rate limiting, CORS, payload limit, idempotency, dan log redaction.
- Webhook HMAC SHA-256, replay tolerance, retry terbatas, delivery history, dan dead-letter status.
- Contoh plain PHP, Laravel, CodeIgniter, REST request, dan webhook receiver.
- Unit/integration tests, Docker, Docker Compose, GitHub Actions, CodeQL, dan secret scanning.

## Persyaratan

- Node.js `22.16.0` atau lebih baru.
- pnpm `10.14.0`.
- TypeScript `5.8.3` tersedia pada PATH untuk bootstrap tanpa dependency registry.

## Instalasi

```bash
git clone https://github.com/muhharis99/opensrc_wa.git
cd opensrc_wa
corepack enable
corepack prepare pnpm@10.14.0 --activate
pnpm install --frozen-lockfile
```

Repository bootstrap sengaja tidak membawa dependency aplikasi. TypeScript dipasang sebagai toolchain global pada CI/Docker agar dependency runtime tetap nol.

## Konfigurasi

```bash
cp .env.example .env
node scripts/hash-api-key.mjs "ganti-dengan-api-key-kuat"
```

Isi hasil SHA-256 ke `OPEN_SRC_WA_API_KEY_SHA256`. Buat key session 32 byte:

```bash
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex')+'\n')"
```

Simpan hasilnya sebagai `OPEN_SRC_WA_SESSION_KEY`. Jangan commit `.env`.

## Build dan validasi

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm docs:check
pnpm dependency:check
```

## Menjalankan gateway

```bash
set -a
. ./.env
set +a
pnpm build
pnpm start
```

Gateway tersedia pada `http://localhost:3000`.

Endpoint publik:

- `GET /health`
- `GET /ready`
- `GET /version`
- `GET /openapi.json`

Endpoint `/api/v1/*` membutuhkan header `X-API-Key`.

## Alur mock pairing

```bash
export OPEN_SRC_WA_API_KEY="api-key-asli"
pnpm build
node dist/apps/cli/src/index.js session:create utama
node dist/apps/cli/src/index.js session:connect utama
node dist/apps/cli/src/index.js session:qr utama
node dist/apps/cli/src/index.js session:mock-complete-pairing utama
node dist/apps/cli/src/index.js session:status utama
```

QR yang diberikan pada mode mock **bukan QR WhatsApp** dan hanya menguji lifecycle API serta session.

## Mengirim pesan mock

```bash
node dist/apps/cli/src/index.js message:send \
  --session utama \
  --to 6281234567890 \
  --text "Pesan pengujian opensrc_wa" \
  --idempotency example-00001
```

Isi pesan tidak dicatat oleh structured logger. Response API hanya mengembalikan metadata pesan.

## WebSocket events

Lakukan upgrade WebSocket ke:

```text
ws://localhost:3000/api/v1/events?api_key=API_KEY
```

Stream ini mengirim event JSON dari runtime mock, termasuk perubahan koneksi, QR mock, session ready, dan message sent.

## Webhook

Daftarkan webhook melalui `POST /api/v1/webhooks`. Signature dihitung dari:

```text
HMAC_SHA256(secret, timestamp + "." + delivery_id + "." + event + "." + raw_body)
```

Lihat `docs/WEBHOOKS.md` dan contoh PHP untuk verifikasi yang aman.

## Integrasi PHP

Contoh tersedia pada:

- `examples/php-integration/plain-php/`
- `examples/php-integration/laravel/`
- `examples/php-integration/codeigniter/`

Contoh meliputi timeout, error handling, idempotency, signature verification, dan duplicate-delivery protection.

## Session persistence

Pilihan store:

```env
OPEN_SRC_WA_STORE=encrypted-file
```

atau:

```env
OPEN_SRC_WA_STORE=sqlite
```

Encrypted file store menggunakan AES-256-GCM dan atomic rename. SQLite adapter menggunakan transaksi dan WAL. Untuk production multi-instance, implementasikan adapter relational melalui contract di `packages/session-store/src/database-adapters.ts`.

## Docker

```bash
docker compose config
docker compose build
docker compose up -d
```

Container berjalan non-root, read-only, tanpa capability Linux tambahan, memiliki health check, dan menyimpan runtime pada volume.

## Testing

Live E2E tidak dijalankan pada CI dan harus tetap:

```env
ENABLE_LIVE_E2E=false
```

Seluruh pengujian repository saat ini menggunakan unit, mock, fixture, SQLite lokal, dan gateway integration test. Tidak ada bukti `LIVE_TESTED`.

## Keamanan dan responsible use

Gunakan hanya untuk akun/perangkat sendiri, komunikasi internal sah, penerima yang menyetujui, dan penelitian interoperabilitas yang mematuhi hukum. Fitur spam, scraping nomor, account farming, anti-ban, ban evasion, CAPTCHA bypass, session hijacking, credential theft, atau pengiriman tanpa izin tidak diterima.

Baca `SECURITY.md`, `docs/SECURITY_MODEL.md`, `docs/THREAT_MODEL.md`, dan `docs/RESPONSIBLE_USE.md`.

## Troubleshooting

- Konfigurasi gagal: pastikan API key hash 64 karakter hex dan session key 64 karakter hex.
- API `401`: header harus membawa API key asli, bukan hash.
- Session tidak ready: selesaikan lifecycle mock pairing.
- Mode `research` mengembalikan `LIVE_PROTOCOL_BLOCKED`: perilaku ini disengaja sampai protokol tervalidasi.
- Peringatan `node:sqlite`: API SQLite masih diberi status eksperimental oleh runtime Node yang digunakan.

## Roadmap

1. Menambah corpus fixture legal dan teranonimkan.
2. Mendokumentasikan observasi black-box yang dapat direproduksi.
3. Memvalidasi handshake, schema, framing, dan lifecycle credential tanpa menyalin implementasi pihak lain.
4. Menambahkan adapter database production.
5. Menjalankan live E2E manual hanya dengan akun pengujian sendiri setelah review keamanan.
6. Media dikerjakan setelah pesan teks live stabil dan terbukti.

## Lisensi

Apache License 2.0. Lihat `LICENSE`.

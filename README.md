# opensrc_wa

`opensrc_wa` adalah platform open-source mandiri untuk penelitian interoperabilitas perangkat berbasis mekanisme WhatsApp Web/Multi-Device dengan pendekatan **clean-room implementation**.

> **Status protokol live: `BLOCKED`.** Versi `0.2.0` menyediakan feature-complete mock runtime, REST API, WebSocket events, webhook, CLI, SDK, dashboard, persistence, keamanan, dan pengujian. Versi ini tidak mengklaim pairing atau pertukaran pesan dengan layanan WhatsApp secara live.

`opensrc_wa` adalah proyek independen dan tidak berafiliasi, tidak disponsori, serta tidak didukung oleh WhatsApp atau Meta.

## Prinsip utama

- Membangun kemampuan publik secara mandiri, bukan menggunakan Baileys, Venom Bot, `whatsapp-web.js`, WPPConnect, open-wa, fork, wrapper, source salinan, atau gateway siap pakai.
- Tidak menggunakan Chromium, Puppeteer, Playwright, Selenium, maupun browser automation sebagai konektor.
- Tidak mengarang endpoint, schema, key, constant, QR, pairing code, atau bukti koneksi live.
- Primitive kriptografi menggunakan Node.js/OpenSSL; proyek mengimplementasikan lifecycle, orchestration, persistence, API, dan domain runtime.
- Runtime default adalah `mock`, sehingga integrasi dapat dikembangkan dan diuji tanpa akun nyata.
- Fitur live hanya boleh berubah menjadi `LIVE_TESTED` setelah memiliki bukti pengujian legal menggunakan akun dan perangkat sendiri.

## Kemampuan versi 0.2.0

### Session dan pairing

- Multi-session lifecycle.
- State machine koneksi.
- QR mock dan pairing-code mock.
- Encrypted file store dan SQLite.
- Reconnect abstraction, logout, penghapusan session.
- Export dan import snapshot session mock.

### Pesan

- Teks, reply, quoted message, forward.
- Reaction, edit, delete untuk diri sendiri atau semua orang.
- Delivery, read, dan played receipt.
- Image, video, audio, voice note, document, dan sticker contract.
- Location dan live-location contract.
- Contact card dan poll.
- View-once serta disappearing-message metadata.
- Incoming-message injection untuk fixture dan integration test.
- Idempotency dan duplicate-event suppression.

### Media

- Upload Base64 dengan MIME validation dan size limit.
- Penyimpanan mock terenkripsi AES-256-GCM.
- SHA-256 integrity metadata.
- Download, list, dan delete.
- Caption, voice-note, dan view-once metadata.

### Chat dan kontak

- Daftar dan pencarian chat.
- Archive, pin, mute, unread counter, dan mark-read state.
- Kontak, profil, about, foto profil, registration check mock.
- Block/unblock.
- Consent grant/revoke dan outbound consent guard.
- History snapshot export dan fixture import.

### Grup, presence, status, channel, dan komunitas

- Membuat grup dan membaca metadata.
- Update subject, description, picture, announce, lock, approval, dan disappearing setting.
- Add/remove participant serta role member/admin/superadmin.
- Invite code, revoke invite, join, dan leave.
- Presence available, unavailable, composing, recording, dan paused.
- Status teks/media, viewer, dan reaction.
- Channel create, follow/unfollow, publish update, dan reaction.
- Community create serta attach/detach subgroup.

### Business, call, label, dan privacy

- Business profile.
- Catalog product create, update, hide, list, dan delete.
- Label chat/message.
- Mock call lifecycle: ringing, accepted, rejected, missed, dan ended.
- Privacy settings termasuk last seen, online, profile photo, read receipt, group invite, dan silence unknown calls.

### Developer experience

- REST API dan OpenAPI 3.1.
- Typed WebSocket event stream.
- Signed webhook dengan retry dan dead-letter history.
- CLI.
- TypeScript SDK.
- Safe in-process plugin hooks.
- Plain PHP, Laravel, dan CodeIgniter examples.
- Dashboard lokal pada `/dashboard`.
- Capability registry pada `/api/v1/capabilities`.
- Docker, Docker Compose, GitHub Actions, CodeQL, dan secret scanning.

## Status kemampuan

Gunakan endpoint:

```text
GET /api/v1/capabilities
```

Setiap kemampuan memiliki salah satu status berikut:

```text
IMPLEMENTED
TESTED_WITH_UNIT
TESTED_WITH_MOCK
TESTED_WITH_FIXTURE
LIVE_TESTED
EXPERIMENTAL
BLOCKED
NOT_STARTED
```

Kemampuan domain pada versi ini berstatus `TESTED_WITH_MOCK`. Handshake, pairing, messaging, media, dan history sync pada jaringan live tetap `BLOCKED`.

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

## Konfigurasi

```bash
cp .env.example .env
node scripts/hash-api-key.mjs "ganti-dengan-api-key-kuat"
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex')+'\n')"
```

Masukkan hasilnya ke:

```env
OPEN_SRC_WA_API_KEY_SHA256=<sha256-api-key>
OPEN_SRC_WA_SESSION_KEY=<64-karakter-hex>
OPEN_SRC_WA_PROTOCOL_MODE=mock
```

Jangan commit `.env`.

## Validasi

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm docs:check
pnpm dependency:check
pnpm license:check
```

Live E2E harus tetap nonaktif pada CI publik:

```env
ENABLE_LIVE_E2E=false
```

## Menjalankan gateway

```bash
set -a
. ./.env
set +a
pnpm build
pnpm start
```

Gateway berjalan pada `http://localhost:3000`.

Endpoint publik:

- `GET /health`
- `GET /ready`
- `GET /version`
- `GET /openapi.json`
- `GET /dashboard`

Endpoint `/api/v1/*` membutuhkan header:

```text
X-API-Key: API_KEY_ASLI
```

## Alur pairing mock

```bash
export OPEN_SRC_WA_API_KEY="api-key-asli"
pnpm build
node dist/apps/cli/src/index.js session:create utama
node dist/apps/cli/src/index.js session:connect utama
node dist/apps/cli/src/index.js session:qr utama
node dist/apps/cli/src/index.js session:mock-complete-pairing utama
```

Alternatif pairing code:

```bash
node dist/apps/cli/src/index.js session:pairing-code utama --phone 6281234567890
node dist/apps/cli/src/index.js session:mock-complete-pairing utama
```

QR dan pairing code tersebut bukan credential WhatsApp. Keduanya hanya menguji lifecycle aplikasi.

## Contoh pesan mock

```bash
node dist/apps/cli/src/index.js message:send \
  --session utama \
  --to 6281234567890 \
  --text "Pesan pengujian opensrc_wa" \
  --idempotency example-00001
```

## WebSocket dan webhook

WebSocket:

```text
ws://localhost:3000/api/v1/events?api_key=API_KEY
```

Webhook signature:

```text
HMAC_SHA256(secret, timestamp + "." + delivery_id + "." + event + "." + raw_body)
```

Lihat `docs/WEBHOOKS.md`.

## Persistence

```env
OPEN_SRC_WA_STORE=encrypted-file
```

atau:

```env
OPEN_SRC_WA_STORE=sqlite
```

Encrypted file store menggunakan AES-256-GCM dan atomic rename. SQLite menggunakan WAL dan transaksi. Adapter MySQL, MariaDB, dan PostgreSQL tetap berupa contract sampai driver produksi dipilih.

## Docker

```bash
docker compose config
docker compose build
docker compose up -d
```

## Keamanan dan responsible use

Gunakan hanya untuk akun/perangkat sendiri, penerima yang menyetujui, komunikasi internal sah, dan penelitian interoperabilitas yang mematuhi hukum. Proyek tidak menerima spam, scraping nomor, account farming, anti-ban, ban evasion, CAPTCHA bypass, fingerprint spoofing, session hijacking, credential theft, atau pengiriman tanpa izin.

Baca `SECURITY.md`, `docs/SECURITY_MODEL.md`, `docs/THREAT_MODEL.md`, dan `docs/RESPONSIBLE_USE.md`.

## Dokumentasi

- `docs/API.md`
- `docs/FEATURE_PARITY.md`
- `docs/MOCK_RUNTIME.md`
- `docs/PROTOCOL_STATUS.md`
- `docs/SDK.md`
- `docs/PLUGINS.md`
- `docs/DASHBOARD.md`
- `docs/HISTORY.md`
- `docs/ROADMAP.md`

## Lisensi

Apache License 2.0. Lihat `LICENSE`.

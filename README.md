# opensrc_wa

`opensrc_wa` adalah gateway WhatsApp tidak resmi berbasis Node.js dan TypeScript dengan arsitektur **multi-provider**.

- `mock`: runtime deterministik untuk development, demo, dan CI.
- `baileys`: provider live pertama, diisolasi melalui adapter.
- `native`: jalur riset WebSocket clean-room untuk masa depan.

> **Unofficial software.** Proyek ini tidak berafiliasi, tidak disponsori, dan tidak didukung oleh WhatsApp atau Meta. WhatsApp dapat mengubah protokol kapan saja sehingga fitur live dapat berhenti berfungsi. Akun dapat dibatasi atau diblokir apabila melanggar Terms of Service.

## Larangan penggunaan

Jangan gunakan proyek ini untuk spam, bulk messaging tanpa persetujuan, scraping nomor, stalkerware, account farming, ban evasion, CAPTCHA bypass, pencurian credential, atau pengiriman pesan kepada penerima yang tidak memberikan izin.

## Arsitektur

```text
REST / CLI / SDK
       |
Application services
       |
WhatsAppProvider
  |-- MockProvider
  |-- BaileysProvider
  `-- NativeProvider (future)
```

Tipe internal Baileys tidak diekspos melalui API publik. Keputusan ini didokumentasikan di `docs/adr/0001-multi-provider-baileys.md`.

## Persyaratan

- Node.js `22.16.0` atau lebih baru.
- pnpm `10.14.0`.
- TypeScript `5.8.3`.

## Instalasi

```bash
git clone https://github.com/muhharis99/opensrc_wa.git
cd opensrc_wa
corepack enable
corepack prepare pnpm@10.14.0 --activate
pnpm install --frozen-lockfile
cp .env.example .env
```

Buat API key hash dan session encryption key:

```bash
node scripts/hash-api-key.mjs "api-key-yang-kuat"
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex')+'\n')"
```

Masukkan hasilnya ke `.env`:

```env
OPEN_SRC_WA_API_KEY_SHA256=<sha256-api-key>
OPEN_SRC_WA_SESSION_KEY=<64-karakter-hex>
```

Jangan commit `.env`, direktori `runtime`, atau credential provider.

## Menjalankan runtime mock

```bash
pnpm build
pnpm start
```

Mock gateway berjalan pada `http://localhost:3000`.

Endpoint publik:

- `GET /health`
- `GET /ready`
- `GET /version`
- `GET /openapi.json`
- `GET /dashboard`

Endpoint `/api/v1/*` membutuhkan:

```text
X-API-Key: API_KEY_ASLI
```

## Menjalankan provider live Baileys

Pastikan `.env` memuat:

```env
LIVE_PORT=3001
OPEN_SRC_WA_BAILEYS_AUTH_DIR=./runtime/baileys-auth
OPEN_SRC_WA_LIVE_RATE_LIMIT_PER_MINUTE=60
```

Kemudian:

```bash
pnpm build
set -a
. ./.env
set +a
pnpm start:live
```

Live gateway berjalan pada `http://localhost:3001`.

### Membuat session dan menampilkan QR

```bash
curl -X POST http://localhost:3001/api/v1/live/sessions/utama/connect \
  -H "X-API-Key: API_KEY_ASLI" \
  -H "Content-Type: application/json" \
  -d '{}'

curl http://localhost:3001/api/v1/live/sessions/utama \
  -H "X-API-Key: API_KEY_ASLI"
```

Nilai `qr` pada response session dipakai untuk membuat gambar QR pada frontend. QR adalah data sensitif sementara dan tidak boleh dicatat ke log publik.

### Pairing code

```bash
curl -X POST http://localhost:3001/api/v1/live/sessions/utama/connect \
  -H "X-API-Key: API_KEY_ASLI" \
  -H "Content-Type: application/json" \
  -d '{"phone":"6281234567890"}'
```

atau:

```bash
curl -X POST http://localhost:3001/api/v1/live/sessions/utama/pairing-code \
  -H "X-API-Key: API_KEY_ASLI" \
  -H "Content-Type: application/json" \
  -d '{"phone":"6281234567890"}'
```

Nomor harus menyertakan kode negara dan hanya berisi digit.

### Kirim teks

```bash
curl -X POST http://localhost:3001/api/v1/live/sessions/utama/messages \
  -H "X-API-Key: API_KEY_ASLI" \
  -H "Content-Type: application/json" \
  -d '{
    "kind":"text",
    "to":"6281234567890@s.whatsapp.net",
    "text":"Halo dari opensrc_wa"
  }'
```

### Kirim media

```bash
curl -X POST http://localhost:3001/api/v1/live/sessions/utama/messages \
  -H "X-API-Key: API_KEY_ASLI" \
  -H "Content-Type: application/json" \
  -d '{
    "kind":"image",
    "to":"6281234567890@s.whatsapp.net",
    "caption":"Contoh gambar",
    "media":{"url":"https://example.com/image.jpg"}
  }'
```

`media` mendukung `base64`, `url`, atau `filePath`. Batasi akses `filePath` hanya ke berkas yang memang diizinkan aplikasi Anda.

### Operasi pesan yang tersedia

- `text` dengan mention dan quoted message;
- `image`, `video`, `audio`, `document`, `sticker`;
- `location`;
- `contact`/vCard;
- `poll`;
- `reaction`;
- `edit`;
- `delete`;
- `forward`.

Semua operasi dikirim ke endpoint `/messages` dengan field `kind` yang sesuai.

### Kontak, chat, dan nomor

```text
GET  /api/v1/live/sessions/{sessionId}/contacts
GET  /api/v1/live/sessions/{sessionId}/chats
POST /api/v1/live/sessions/{sessionId}/numbers/check
POST /api/v1/live/sessions/{sessionId}/contacts/block
```

### Grup

```text
POST /api/v1/live/sessions/{sessionId}/groups
```

Field `operation` mendukung:

- `create`;
- `participants` dengan `add`, `remove`, `promote`, atau `demote`;
- `subject`;
- `description`;
- `setting`;
- `invite`;
- `revoke-invite`;
- `accept-invite`.

### Presence dan profil

```text
POST /api/v1/live/sessions/{sessionId}/presence
POST /api/v1/live/sessions/{sessionId}/profile
```

Presence mendukung `available`, `unavailable`, `composing`, `recording`, dan `paused`.

### Download media masuk

```text
POST /api/v1/live/sessions/{sessionId}/media/download
```

Kirim object pesan provider pada field `message`. Response mengandung media Base64. Untuk produksi, pindahkan streaming media ke object storage agar tidak membebani memory.

## Webhook live

Set:

```env
OPEN_SRC_WA_LIVE_WEBHOOK_URL=https://example.com/webhooks/whatsapp
OPEN_SRC_WA_LIVE_WEBHOOK_SECRET=secret-minimal-24-karakter
```

Event provider akan dikirim menggunakan HMAC signature, retry terbatas, dan dead-letter history. Riwayat tersedia pada:

```text
GET /api/v1/live/webhooks/history
```

## Multi-session dan session restore

Setiap `sessionId` memiliki direktori auth terpisah di `OPEN_SRC_WA_BAILEYS_AUTH_DIR`. Credential diperbarui pada event `creds.update`, sehingga session dapat dipulihkan setelah restart.

Utility multi-file cocok untuk bootstrap dan instalasi kecil. Untuk ratusan session, implementasikan auth repository database dan distributed locking sebelum produksi.

## Auto reconnect

Adapter melakukan reconnect eksponensial untuk disconnect yang retryable. Reconnect tidak dijalankan untuk logout, session conflict, atau disconnect manual.

## Rate limiting

- Mock gateway memiliki HTTP rate limit sendiri.
- Live gateway memiliki `OPEN_SRC_WA_LIVE_RATE_LIMIT_PER_MINUTE`.
- Aplikasi produksi tetap perlu outbound queue per session/chat, pacing, retry budget, consent registry, dan circuit breaker.

## Pengujian

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

Adapter Baileys diuji menggunakan fake module, tanpa membuka koneksi WhatsApp. Live E2E dinonaktifkan secara default:

```env
ENABLE_LIVE_E2E=false
```

## Status fitur

Runtime mock tetap menyediakan feature-parity luas untuk pengembangan. Provider live pertama mencakup session, QR, pairing code, session restore, auto reconnect, pesan, media, receipt/event mapping, presence, kontak, chat, grup, block/unblock, profil, history event, dan call event.

Keterbatasan yang masih harus diuji langsung per versi provider dicatat pada `docs/LIVE_PROVIDER_STATUS.md`.

## Dokumentasi

- `AUDIT.md`
- `docs/ARCHITECTURE.md`
- `docs/adr/0001-multi-provider-baileys.md`
- `docs/API.md`
- `docs/LIVE_PROVIDER_STATUS.md`
- `docs/DEPENDENCY_POLICY.md`
- `docs/RESPONSIBLE_USE.md`
- `docs/SECURITY_MODEL.md`
- `docs/THREAT_MODEL.md`
- `docs/TESTING.md`

## Lisensi

Kode `opensrc_wa` menggunakan Apache License 2.0. Baileys merupakan dependency terpisah dengan lisensi MIT. Lihat notice dan lisensi masing-masing dependency.

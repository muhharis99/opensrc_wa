# opensrc_wa

`opensrc_wa` adalah gateway WhatsApp tidak resmi berbasis Node.js dan TypeScript dengan arsitektur **multi-provider**.

- `mock`: runtime deterministik untuk development, demo, dan CI.
- `baileys`: provider live pertama, diisolasi melalui `BaileysProvider`.
- `native`: jalur riset WebSocket/Noise/Signal clean-room yang tetap `BLOCKED` sampai tersedia bukti legal dan dapat direproduksi.

> **Unofficial software.** Proyek ini tidak berafiliasi, tidak disponsori, dan tidak didukung oleh WhatsApp atau Meta. WhatsApp dapat mengubah protokol kapan saja sehingga fitur live dapat berhenti berfungsi. Akun dapat dibatasi atau diblokir apabila melanggar Terms of Service.

## Larangan penggunaan

Jangan gunakan proyek ini untuk spam, bulk messaging tanpa persetujuan, scraping nomor, stalkerware, account farming, ban evasion, CAPTCHA bypass, pencurian credential, atau pengiriman pesan kepada penerima yang tidak memberikan izin.

## Arsitektur

```text
REST API / Dashboard / CLI / SDK
               |
       Application services
               |
        WhatsAppProvider
       /        |        \
MockProvider BaileysProvider NativeProvider
                                (BLOCKED)
```

Tipe internal provider tidak diekspos melalui kontrak API publik.

## Kemampuan v0.4.0

- Multi-session, QR, pairing code, session restore, logout, reconnect, dan conflict detection.
- QR sebagai payload, PNG, Base64, serta data URL.
- Teks, media, location, vCard, poll, reply, mention, reaction, edit, forward, buttons, dan list.
- Native broadcast/status broadcast untuk broadcast JID yang sudah tersedia pada akun.
- Delete-for-me dan delete-for-everyone sebagai operasi berbeda.
- Kontak, chat, number check, presence, group, profile, webhook, dan media download.
- Dashboard live pada `/dashboard`.
- SQLite auth state untuk skala satu host, selain mode multi-file.
- Session lease lock dengan owner token dan TTL.
- Outbound queue dengan pacing per session dan chat.
- Streaming media ke object store tanpa wajib mengubahnya menjadi Base64.
- Live E2E harness opt-in untuk akun dan perangkat milik sendiri.
- Native provider research boundary yang menolak koneksi ketika bukti protokol belum tersedia.

Buttons dan list berstatus **EXPERIMENTAL** karena dukungan interactive message dapat berubah pada versi provider atau WhatsApp.

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

Buat API-key hash dan session encryption key:

```bash
node scripts/hash-api-key.mjs "api-key-yang-kuat"
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex')+'\n')"
```

Masukkan hasilnya ke `.env`:

```env
OPEN_SRC_WA_API_KEY_SHA256=<sha256-api-key>
OPEN_SRC_WA_SESSION_KEY=<64-karakter-hex>
```

Jangan commit `.env`, direktori `runtime`, QR, pairing code, auth database, atau credential provider.

## Runtime mock

```bash
pnpm build
pnpm start
```

Mock gateway berjalan pada `http://localhost:3000`.

## Live gateway

Konfigurasi minimum:

```env
LIVE_PORT=3001
OPEN_SRC_WA_BAILEYS_AUTH_STORE=sqlite
OPEN_SRC_WA_BAILEYS_AUTH_DATABASE=./runtime/baileys-auth.sqlite
OPEN_SRC_WA_SESSION_LEASE_DATABASE=./runtime/session-leases.sqlite
OPEN_SRC_WA_OBJECT_STORE_DIR=./runtime/objects
OPEN_SRC_WA_LIVE_RATE_LIMIT_PER_MINUTE=60
```

Jalankan:

```bash
pnpm build
set -a
. ./.env
set +a
pnpm start:live
```

Live gateway berjalan pada `http://localhost:3001` dan dashboard pada:

```text
http://localhost:3001/dashboard
```

Endpoint `/api/v1/live/*` membutuhkan:

```text
X-API-Key: API_KEY_ASLI
```

## Session dan QR

Connect dengan QR:

```bash
curl -X POST http://localhost:3001/api/v1/live/sessions/utama/connect \
  -H "X-API-Key: API_KEY_ASLI" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Ambil QR:

```text
GET /api/v1/live/sessions/utama/qr
GET /api/v1/live/sessions/utama/qr.png
```

Endpoint JSON memberikan `payload`, `base64`, dan `data_url`. QR adalah credential sementara dan tidak boleh dicatat ke log publik.

Pairing code:

```bash
curl -X POST http://localhost:3001/api/v1/live/sessions/utama/connect \
  -H "X-API-Key: API_KEY_ASLI" \
  -H "Content-Type: application/json" \
  -d '{"phone":"6281234567890"}'
```

## Kirim pesan

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

`kind` yang tersedia:

```text
text, image, video, audio, document, sticker,
location, contact, poll, buttons, list, broadcast,
reaction, edit, delete, forward
```

Contoh payload lengkap tersedia di `docs/LIVE_API.md`.

## Auth database dan session lock

Mode development kecil:

```env
OPEN_SRC_WA_BAILEYS_AUTH_STORE=multi-file
OPEN_SRC_WA_BAILEYS_AUTH_DIR=./runtime/baileys-auth
```

Mode SQLite:

```env
OPEN_SRC_WA_BAILEYS_AUTH_STORE=sqlite
OPEN_SRC_WA_BAILEYS_AUTH_DATABASE=./runtime/baileys-auth.sqlite
OPEN_SRC_WA_SESSION_LEASE_DATABASE=./runtime/session-leases.sqlite
OPEN_SRC_WA_SESSION_LEASE_TTL_MS=30000
```

SQLite auth cocok untuk banyak session pada satu host. Deployment lintas server tetap membutuhkan database terpusat dan distributed lease adapter yang mendukung compare-and-set, TTL, owner token, serta fencing token. Baca `docs/AUTH_STORAGE.md`.

## Outbound queue

```env
OPEN_SRC_WA_OUTBOUND_SESSION_INTERVAL_MS=750
OPEN_SRC_WA_OUTBOUND_CHAT_INTERVAL_MS=1250
OPEN_SRC_WA_OUTBOUND_MAX_PENDING=1000
```

Semua pengiriman live diproses berurutan per session dan diberi interval tambahan per chat. Queue ini adalah guardrail, bukan sarana menghindari pembatasan WhatsApp. Baca `docs/OUTBOUND_QUEUE.md`.

## Streaming media

Media masuk dapat dikembalikan sebagai Base64 atau dialirkan langsung ke object store lokal:

```json
{
  "message": {},
  "storage": "object",
  "content_type": "image/jpeg",
  "file_name": "foto.jpg"
}
```

Baca `docs/OBJECT_STORAGE.md`.

## Live E2E

Live E2E dinonaktifkan secara default dan tidak dijalankan di CI publik:

```env
ENABLE_LIVE_E2E=false
```

Pengujian hanya boleh menggunakan akun, perangkat, dan penerima milik sendiri atau yang memberikan izin. Setelah live gateway berjalan, isi variabel `LIVE_E2E_*`, lalu jalankan:

```bash
pnpm test:live
```

Harness menunggu QR/pairing dan mengirim pesan unik. Harness tidak mengklaim receive E2E tanpa webhook atau bukti balasan. Baca `docs/LIVE_E2E.md`.

## Native WebSocket/Noise/Signal

`NativeProvider` telah memiliki contract dan status endpoint:

```text
GET /api/v1/live/native/status
```

Koneksi tetap `BLOCKED`. Proyek tidak mengarang endpoint, framing, key, handshake, Noise, atau Signal constant. Baca `docs/NATIVE_PROVIDER_STATUS.md`.

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

## Docker

```bash
cp .env.example .env
docker compose build
docker compose up -d
docker compose ps
```

- mock gateway: port `3000`;
- live gateway: port `3001`.

## Dokumentasi

- `AUDIT.md`
- `docs/ARCHITECTURE.md`
- `docs/adr/0001-multi-provider-baileys.md`
- `docs/API.md`
- `docs/LIVE_API.md`
- `docs/LIVE_E2E.md`
- `docs/AUTH_STORAGE.md`
- `docs/OUTBOUND_QUEUE.md`
- `docs/OBJECT_STORAGE.md`
- `docs/LIVE_PROVIDER_STATUS.md`
- `docs/NATIVE_PROVIDER_STATUS.md`
- `docs/DEPENDENCY_POLICY.md`
- `docs/RESPONSIBLE_USE.md`
- `docs/SECURITY_MODEL.md`
- `docs/THREAT_MODEL.md`
- `docs/TESTING.md`

## Lisensi

Kode `opensrc_wa` menggunakan Apache License 2.0. Dependency pihak ketiga mempertahankan lisensinya masing-masing.

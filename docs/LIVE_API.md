# Live Gateway API v0.4.0

Base URL default:

```text
http://localhost:3001
```

Semua endpoint `/api/v1/live/*` membutuhkan `X-API-Key`. Dashboard tersedia pada `/dashboard` dan meminta API key di browser.

## Health dan runtime

```text
GET /health
GET /ready
GET /api/v1/live/queue
GET /api/v1/live/native/status
```

`/api/v1/live/native/status` tetap `BLOCKED` sampai riset clean-room menyediakan bukti endpoint, framing, Noise, Signal, pairing, dan live E2E.

## Session

```text
GET  /api/v1/live/sessions
GET  /api/v1/live/sessions/{sessionId}
POST /api/v1/live/sessions/{sessionId}/connect
POST /api/v1/live/sessions/{sessionId}/pairing-code
POST /api/v1/live/sessions/{sessionId}/disconnect
POST /api/v1/live/sessions/{sessionId}/logout
```

Connect QR:

```json
{}
```

Connect pairing code:

```json
{
  "phone": "6281234567890",
  "sync_full_history": false
}
```

## QR PNG, Base64, dan data URL

```text
GET /api/v1/live/sessions/{sessionId}/qr
GET /api/v1/live/sessions/{sessionId}/qr.png
```

Response JSON QR:

```json
{
  "session_id": "utama",
  "payload": "provider-qr-payload",
  "base64": "iVBORw0KGgo...",
  "data_url": "data:image/png;base64,iVBORw0KGgo..."
}
```

QR adalah credential sementara. Jangan menyimpannya ke log, issue, screenshot publik, analytics, atau layanan pihak ketiga.

## Mengirim pesan

```text
POST /api/v1/live/sessions/{sessionId}/messages
```

### Teks

```json
{
  "kind": "text",
  "to": "6281234567890@s.whatsapp.net",
  "text": "Halo",
  "mentions": ["6281111111111@s.whatsapp.net"],
  "quoted": null
}
```

### Media

`kind`: `image`, `video`, `audio`, `document`, atau `sticker`.

```json
{
  "kind": "image",
  "to": "6281234567890@s.whatsapp.net",
  "caption": "Contoh",
  "media": {
    "url": "https://example.com/image.jpg",
    "mimeType": "image/jpeg",
    "fileName": "image.jpg"
  }
}
```

Media mendukung `base64`, `url`, atau `filePath`.

### Buttons

Status provider: `EXPERIMENTAL`, karena kemampuan interactive message dapat berubah pada versi WhatsApp/Baileys.

```json
{
  "kind": "buttons",
  "to": "6281234567890@s.whatsapp.net",
  "text": "Pilih tindakan",
  "footer": "opensrc_wa",
  "buttons": [
    {"id":"yes","text":"Ya"},
    {"id":"no","text":"Tidak"}
  ]
}
```

Maksimal tiga tombol.

### List

Status provider: `EXPERIMENTAL`.

```json
{
  "kind": "list",
  "to": "6281234567890@s.whatsapp.net",
  "title": "Menu",
  "text": "Silakan pilih",
  "footer": "opensrc_wa",
  "button_text": "Buka menu",
  "sections": [
    {
      "title": "Layanan",
      "rows": [
        {"id":"help","title":"Bantuan","description":"Hubungi petugas"}
      ]
    }
  ]
}
```

Maksimal 10 section dan 100 row keseluruhan.

### Native broadcast list / status broadcast

WhatsApp Web tidak menyediakan pembuatan broadcast list baru, tetapi provider dapat mengirim ke broadcast JID yang sudah ada dan membaca informasinya.

```json
{
  "kind": "broadcast",
  "to": "12345678@broadcast",
  "text": "Pengumuman untuk penerima yang telah menyetujui"
}
```

Status broadcast:

```json
{
  "kind": "broadcast",
  "to": "status@broadcast",
  "text": "Status pengujian",
  "status_jid_list": ["6281234567890@s.whatsapp.net"]
}
```

Informasi list:

```text
GET /api/v1/live/sessions/{sessionId}/broadcasts/{broadcastJid}
```

Jangan menggunakan broadcast untuk bulk messaging tanpa izin.

### Delete for everyone

```json
{
  "kind": "delete",
  "scope": "everyone",
  "to": "6281234567890@s.whatsapp.net",
  "key": {
    "remoteJid": "6281234567890@s.whatsapp.net",
    "id": "MESSAGE_ID",
    "fromMe": true
  }
}
```

### Delete for me

```json
{
  "kind": "delete",
  "scope": "me",
  "timestamp": 1710000000,
  "delete_media": true,
  "to": "6281234567890@s.whatsapp.net",
  "key": {
    "remoteJid": "6281234567890@s.whatsapp.net",
    "id": "MESSAGE_ID",
    "fromMe": true
  }
}
```

`delete-for-me` memakai `chatModify` dan memerlukan timestamp pesan.

### Jenis lain

`location`, `contact`, `poll`, `reaction`, `edit`, dan `forward` tetap tersedia seperti versi sebelumnya.

## Download media

Kompatibilitas Base64:

```json
{
  "message": {}
}
```

Streaming ke object store:

```json
{
  "message": {},
  "storage": "object",
  "content_type": "image/jpeg",
  "file_name": "foto.jpg"
}
```

Endpoint:

```text
POST /api/v1/live/sessions/{sessionId}/media/download
GET  /api/v1/live/objects/{objectId}
```

Object download membutuhkan API key.

## Kontak, chat, nomor, presence, grup, dan profil

```text
GET  /api/v1/live/sessions/{sessionId}/contacts
GET  /api/v1/live/sessions/{sessionId}/chats
POST /api/v1/live/sessions/{sessionId}/numbers/check
POST /api/v1/live/sessions/{sessionId}/contacts/block
POST /api/v1/live/sessions/{sessionId}/presence
POST /api/v1/live/sessions/{sessionId}/groups
POST /api/v1/live/sessions/{sessionId}/profile
```

## Queue

Semua send melewati queue per session dan chat. `OUTBOUND_QUEUE_FULL` menghasilkan HTTP `429`. Statistik tersedia pada:

```text
GET /api/v1/live/queue
```

## Auth database dan lock

Mode auth:

```env
OPEN_SRC_WA_BAILEYS_AUTH_STORE=multi-file
```

atau:

```env
OPEN_SRC_WA_BAILEYS_AUTH_STORE=sqlite
OPEN_SRC_WA_BAILEYS_AUTH_DATABASE=./runtime/baileys-auth.sqlite
```

Session lock:

```env
OPEN_SRC_WA_SESSION_LEASE_DATABASE=./runtime/session-leases.sqlite
OPEN_SRC_WA_SESSION_LEASE_TTL_MS=30000
```

Session yang sedang dimiliki proses lain menghasilkan HTTP `409` dengan code `SESSION_LOCKED`.

## Webhook

Event connection, QR, message, presence, group, contact, chat, call, history, dan provider error diteruskan ke webhook HMAC jika dikonfigurasi.

```text
GET /api/v1/live/webhooks/history
```

## Dashboard

```text
GET /dashboard
```

Dashboard menampilkan health, daftar session, status, QR PNG, pairing code, connect, disconnect, dan logout. API key hanya disimpan di `sessionStorage` browser.

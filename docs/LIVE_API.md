# Live Gateway API

Base URL default:

```text
http://localhost:3001
```

Semua endpoint `/api/v1/live/*` membutuhkan:

```text
X-API-Key: API_KEY_ASLI
Content-Type: application/json
```

## Response envelope

Berhasil:

```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": {
    "request_id": "uuid",
    "timestamp": "ISO-8601"
  }
}
```

Gagal:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "LIVE_PROVIDER_ERROR",
    "message": "Penjelasan error"
  },
  "meta": {
    "request_id": "uuid",
    "timestamp": "ISO-8601"
  }
}
```

## Health

```text
GET /health
GET /ready
```

## Session

```text
GET  /api/v1/live/sessions
GET  /api/v1/live/sessions/{sessionId}
POST /api/v1/live/sessions/{sessionId}/connect
POST /api/v1/live/sessions/{sessionId}/pairing-code
POST /api/v1/live/sessions/{sessionId}/disconnect
POST /api/v1/live/sessions/{sessionId}/logout
```

Connect dengan QR:

```json
{}
```

Connect dengan pairing code:

```json
{
  "phone": "6281234567890",
  "sync_full_history": false
}
```

Status session dapat mengandung:

```json
{
  "sessionId": "utama",
  "state": "awaiting_pairing",
  "qr": "provider-qr-payload",
  "pairingCode": null,
  "phone": null,
  "updatedAt": "ISO-8601",
  "lastError": null
}
```

Nilai QR adalah payload provider, bukan gambar. Frontend dapat merendernya dengan QR encoder milik aplikasi. Jangan menyimpan atau mencatat payload QR ke log publik.

## Pesan

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

`kind` dapat berupa `image`, `video`, `audio`, `document`, atau `sticker`.

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

Sumber media mendukung satu dari:

```json
{"base64":"..."}
```

```json
{"url":"https://example.com/file"}
```

```json
{"filePath":"/app/runtime/uploads/file.jpg"}
```

Untuk audio voice note:

```json
{
  "kind": "audio",
  "to": "6281234567890@s.whatsapp.net",
  "voice_note": true,
  "media": {
    "filePath": "/app/runtime/uploads/note.ogg",
    "mimeType": "audio/ogg; codecs=opus"
  }
}
```

### Lokasi

```json
{
  "kind": "location",
  "to": "6281234567890@s.whatsapp.net",
  "latitude": -7.5666,
  "longitude": 110.8167,
  "name": "Surakarta",
  "address": "Jawa Tengah"
}
```

### Kontak

```json
{
  "kind": "contact",
  "to": "6281234567890@s.whatsapp.net",
  "display_name": "Contoh Kontak",
  "vcard": "BEGIN:VCARD\nVERSION:3.0\nFN:Contoh Kontak\nTEL;TYPE=CELL:+628111111111\nEND:VCARD"
}
```

### Poll

```json
{
  "kind": "poll",
  "to": "120000000000000000@g.us",
  "question": "Pilih jadwal",
  "options": ["Senin", "Selasa"],
  "selectable_count": 1
}
```

### Reaction

```json
{
  "kind": "reaction",
  "to": "6281234567890@s.whatsapp.net",
  "emoji": "👍",
  "key": {
    "remoteJid": "6281234567890@s.whatsapp.net",
    "id": "MESSAGE_ID",
    "fromMe": false
  }
}
```

### Edit

```json
{
  "kind": "edit",
  "to": "6281234567890@s.whatsapp.net",
  "text": "Teks yang diperbarui",
  "key": {
    "remoteJid": "6281234567890@s.whatsapp.net",
    "id": "MESSAGE_ID",
    "fromMe": true
  }
}
```

### Delete

```json
{
  "kind": "delete",
  "to": "6281234567890@s.whatsapp.net",
  "key": {
    "remoteJid": "6281234567890@s.whatsapp.net",
    "id": "MESSAGE_ID",
    "fromMe": true
  }
}
```

### Forward

```json
{
  "kind": "forward",
  "to": "6281234567890@s.whatsapp.net",
  "message": {}
}
```

## Media masuk

```text
POST /api/v1/live/sessions/{sessionId}/media/download
```

```json
{
  "message": {}
}
```

Response:

```json
{
  "base64": "...",
  "size": 1024
}
```

## Kontak dan chat

```text
GET  /api/v1/live/sessions/{sessionId}/contacts
GET  /api/v1/live/sessions/{sessionId}/chats
POST /api/v1/live/sessions/{sessionId}/numbers/check
POST /api/v1/live/sessions/{sessionId}/contacts/block
```

Cek nomor:

```json
{
  "numbers": ["6281234567890", "6281111111111"]
}
```

Block atau unblock:

```json
{
  "jid": "6281234567890@s.whatsapp.net",
  "action": "block"
}
```

## Presence

```text
POST /api/v1/live/sessions/{sessionId}/presence
```

```json
{
  "state": "composing",
  "jid": "6281234567890@s.whatsapp.net"
}
```

State: `available`, `unavailable`, `composing`, `recording`, atau `paused`.

## Grup

```text
POST /api/v1/live/sessions/{sessionId}/groups
```

Buat grup:

```json
{
  "operation": "create",
  "subject": "Tim",
  "participants": ["6281234567890@s.whatsapp.net"]
}
```

Kelola peserta:

```json
{
  "operation": "participants",
  "group_jid": "120000000000000000@g.us",
  "participants": ["6281234567890@s.whatsapp.net"],
  "action": "add"
}
```

Action peserta: `add`, `remove`, `promote`, atau `demote`.

Operasi lain:

- `subject` dengan `group_jid` dan `value`;
- `description` dengan `group_jid` dan `value`;
- `setting` dengan `group_jid` dan `setting`;
- `invite` dengan `group_jid`;
- `revoke-invite` dengan `group_jid`;
- `accept-invite` dengan `code`.

## Profil

```text
POST /api/v1/live/sessions/{sessionId}/profile
```

Nama:

```json
{"operation":"name","value":"Nama Baru"}
```

Status:

```json
{"operation":"status","value":"Sedang bekerja"}
```

Foto:

```json
{
  "operation": "picture",
  "jid": "6281234567890@s.whatsapp.net",
  "base64": "..."
}
```

## Webhook

Set URL dan secret melalui environment. Event provider seperti connection, QR, message, presence, group, contact, chat, call, dan history diteruskan menggunakan HMAC signature.

```text
GET /api/v1/live/webhooks/history
```

## Error dan retry

- Error autentikasi menghasilkan HTTP `401`.
- Rate limit menghasilkan HTTP `429`.
- Error provider atau validasi saat ini menghasilkan HTTP `400` dengan code `LIVE_PROVIDER_ERROR`.
- Auto reconnect hanya dilakukan untuk disconnect retryable.
- Logout, conflict, dan disconnect manual tidak memicu reconnect.

## Batasan v0.3.0

- QR masih berupa payload, belum PNG/Base64 image.
- Buttons dan list message belum distabilkan.
- WhatsApp broadcast-list native belum diimplementasikan; contoh broadcast menggunakan pengiriman bertahap kepada penerima yang memberikan persetujuan.
- Delete-for-me belum dibedakan sebagai operasi provider tersendiri.
- Dashboard live khusus belum tersedia.
- Live E2E belum diklaim lulus.
- Auth database, distributed lock, outbound queue, dan streaming object storage masih backlog produksi.

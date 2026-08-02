# Live Provider Status

Provider dependency: `@whiskeysockets/baileys@7.0.0-rc13`

Status dokumen: 2026-08-03

## Implementasi adapter

| Domain | Implementasi | Automated test | Live E2E |
|---|---:|---:|---:|
| Multi-session | Ya | Ya | Belum |
| QR payload/PNG/Base64/data URL | Ya | Ya | Belum |
| Pairing code | Ya | Fake-provider test | Belum |
| Multi-file auth | Ya | Boundary test | Belum |
| SQLite auth credentials dan keys | Ya | Ya | Belum |
| Session lease dan conflict rejection | Ya | Ya | Belum |
| Auto reconnect | Ya | Boundary mapping | Belum |
| Text/reply/mention | Ya | Ya | Belum |
| Image/video/audio/document/sticker | Ya | Boundary/type test | Belum |
| Location/contact/poll | Ya | Boundary/type test | Belum |
| Buttons | Experimental | Fake-provider test | Belum |
| List | Experimental | Fake-provider test | Belum |
| Existing native broadcast JID | Ya | Fake-provider test | Belum |
| Status broadcast | Ya | Boundary test | Belum |
| Create new broadcast list | Tidak diklaim | N/A | N/A |
| Reaction/edit/forward | Ya | Boundary/type test | Belum |
| Delete-for-everyone | Ya | Ya | Belum |
| Delete-for-me | Ya | Ya | Belum |
| Incoming message/events | Ya | Event mapping | Belum |
| Presence | Ya | Boundary/type test | Belum |
| Contacts/chats/number check | Ya | Ya | Belum |
| Group/member/admin/settings/invite | Ya | Ya | Belum |
| Block/unblock dan profile | Ya | Boundary/type test | Belum |
| Media download/decrypt | Ya | Ya | Belum |
| Streaming object storage | Ya | Ya | Belum |
| Outbound queue/pacing | Ya | Ya | Belum |
| Dashboard live | Ya | Build/integration boundary | Belum |
| Webhook forwarding | Ya | Webhook unit test | Belum |
| History/call events | Ya | Event mapping | Belum |
| Native WebSocket/Noise/Signal | BLOCKED | Blocker test | Belum |

## Arti status

`IMPLEMENTED` atau `Ya` berarti adapter/API tersedia dan lulus pengujian tanpa membuka koneksi WhatsApp nyata. Fitur belum boleh disebut `LIVE_TESTED` sampai dijalankan menggunakan akun dan perangkat milik tester pada versi dependency yang dikunci.

Buttons dan list tetap `EXPERIMENTAL` karena dukungan interactive message dapat berubah. Broadcast hanya mendukung broadcast JID/status yang sudah dapat diakses akun; repository tidak mengklaim dapat membuat broadcast list baru dari WhatsApp Web.

## Batas produksi yang masih tersisa

1. Menjalankan live E2E opt-in menggunakan akun/perangkat milik pengguna.
2. Menyimpan hasil koneksi, send, delivered/read, dan receive secara privat tanpa credential atau isi percakapan.
3. Mengganti SQLite lease dengan distributed lease terpusat untuk deployment lintas server.
4. Mengganti in-process queue dengan durable broker untuk deployment multi-node.
5. Mengganti local object store dengan S3-compatible encrypted storage untuk horizontal scaling.
6. Menambah per-tenant permission, quota, audit, dan encryption-key rotation.
7. Menjalankan contract test untuk setiap upgrade provider.
8. Menambah reconnect metrics, lease-loss metrics, queue latency, dan storage quota alerts.

## Status native provider

`packages/provider-native` tidak mengimplementasikan endpoint atau handshake yang ditebak. Koneksi selalu ditolak dengan `NATIVE_PROTOCOL_BLOCKED` sampai bukti clean-room untuk endpoint, framing, Noise, Signal, pairing, dan live E2E tersedia. Lihat `docs/NATIVE_PROVIDER_STATUS.md`.

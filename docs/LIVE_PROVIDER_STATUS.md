# Live Provider Status

Provider: `@whiskeysockets/baileys@7.0.0-rc13`

Status dokumen: 2026-08-03

## Implementasi adapter

| Domain | Implementasi adapter | Automated test | Live E2E |
|---|---:|---:|---:|
| Multi-session | Ya | Ya | Belum |
| QR event | Ya | Ya dengan fake module | Belum |
| Pairing code | Ya | Ya dengan fake module | Belum |
| Auth state save/restore | Ya | Boundary test | Belum |
| Auto reconnect | Ya | Belum lengkap | Belum |
| Text | Ya | Ya | Belum |
| Image/video/audio/document/sticker | Ya | Type-check | Belum |
| Location/contact/poll | Ya | Type-check | Belum |
| Reply/mention | Ya | Type-check | Belum |
| Reaction/edit/delete/forward | Ya | Type-check | Belum |
| Incoming messages | Ya | Event mapping | Belum |
| Message updates | Ya | Event mapping | Belum |
| Presence | Ya | Type-check | Belum |
| Contacts/chats | Ya | Unit boundary | Belum |
| Number registration check | Ya | Unit boundary | Belum |
| Group create/member/admin/settings/invite | Ya | Unit boundary | Belum |
| Block/unblock | Ya | Type-check | Belum |
| Profile name/status/picture | Ya | Type-check | Belum |
| Media download/decrypt | Ya | Boundary test | Belum |
| History event | Ya | Event mapping | Belum |
| Calls event | Ya | Event mapping | Belum |
| Webhook forwarding | Ya | Existing webhook unit test | Belum |

## Catatan penting

`IMPLEMENTED` berarti adapter dan API tersedia. Fitur belum boleh disebut `LIVE_TESTED` sampai diuji menggunakan akun/perangkat milik sendiri pada versi dependency yang dikunci.

Fitur interaktif tertentu, broadcast list, newsletter/channel mutation, community mutation, dan business catalog live belum distabilkan pada API live gateway. Semuanya tetap tersedia pada mock runtime dan dicatat sebagai backlog live-provider.

## Backlog produksi

1. Auth repository database menggantikan multi-file untuk skala besar.
2. Distributed lock per session.
3. Outbound queue, pacing, retry budget, dan circuit breaker.
4. Streaming media ke object storage.
5. Live E2E opt-in menggunakan akun uji milik sendiri.
6. Contract test terhadap setiap upgrade Baileys.
7. Provider health metrics dan reconnect observability.
8. Per-session permission dan tenant isolation.

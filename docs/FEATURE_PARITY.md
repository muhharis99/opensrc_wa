# Feature Parity Matrix

Dokumen ini mencatat kemampuan publik yang tersedia pada runtime `opensrc_wa` tanpa menyatakan kesetaraan implementasi internal dengan proyek lain.

## Aturan status

- `TESTED_WITH_MOCK`: berfungsi pada runtime deterministic mock dan diuji otomatis.
- `TESTED_WITH_FIXTURE`: diuji terhadap fixture legal serta teranonimkan.
- `LIVE_TESTED`: hanya untuk fitur yang terbukti pada akun/perangkat pengujian sendiri.
- `BLOCKED`: bukti clean-room untuk protokol live belum cukup.

## Matrix

| Domain | Kemampuan | Mock runtime | Live protocol |
|---|---|---:|---:|
| Session | Multi-session lifecycle | TESTED_WITH_MOCK | BLOCKED |
| Session | QR dan pairing code | TESTED_WITH_MOCK | BLOCKED |
| Session | Snapshot export/import | TESTED_WITH_MOCK | BLOCKED |
| Messaging | Text, reply, quote, forward | TESTED_WITH_MOCK | BLOCKED |
| Messaging | Reaction, edit, delete | TESTED_WITH_MOCK | BLOCKED |
| Messaging | Delivery/read/played receipt | TESTED_WITH_MOCK | BLOCKED |
| Messaging | Poll, location, contact card | TESTED_WITH_MOCK | BLOCKED |
| Media | Image/video/audio/document/sticker | TESTED_WITH_MOCK | BLOCKED |
| Chat | Archive, pin, mute, search | TESTED_WITH_MOCK | BLOCKED |
| Contact | Profile, registration check, block | TESTED_WITH_MOCK | BLOCKED |
| Consent | Grant, revoke, outbound guard | TESTED_WITH_MOCK | N/A |
| Group | Metadata, participant, role, invite | TESTED_WITH_MOCK | BLOCKED |
| Presence | Available, typing, recording | TESTED_WITH_MOCK | BLOCKED |
| Status | Publish, view, reaction | TESTED_WITH_MOCK | BLOCKED |
| Channel | Follow, update, reaction | TESTED_WITH_MOCK | BLOCKED |
| Community | Subgroup membership | TESTED_WITH_MOCK | BLOCKED |
| Business | Profile dan catalog | TESTED_WITH_MOCK | BLOCKED |
| Labels | Chat/message labels | TESTED_WITH_MOCK | BLOCKED |
| Calls | Incoming/outgoing lifecycle events | TESTED_WITH_MOCK | BLOCKED |
| Privacy | Last seen, profile, receipt, calls | TESTED_WITH_MOCK | BLOCKED |
| History | Snapshot export/import fixture | TESTED_WITH_MOCK | BLOCKED |
| Gateway | REST, WebSocket, webhook | TESTED_WITH_MOCK | N/A |
| SDK | TypeScript client | TESTED_WITH_UNIT | N/A |
| Plugins | Safe in-process hooks | TESTED_WITH_UNIT | N/A |
| Dashboard | Local management view | IMPLEMENTED | N/A |

Sumber kebenaran mesin tersedia melalui `GET /api/v1/capabilities`.

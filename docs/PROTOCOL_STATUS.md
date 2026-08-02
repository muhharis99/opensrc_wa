# Protocol Status

| Fitur | Status | Pengujian | Bukti | Catatan |
|---|---|---|---|---|
| Core state machine | TESTED_WITH_UNIT | Unit | `tests/state-machine.test.ts` | Lifecycle internal |
| Typed events | TESTED_WITH_MOCK | Integration | Gateway integration | Event runtime mock |
| Generic WebSocket transport | IMPLEMENTED | Type-check | Source | Bukan endpoint live |
| Mock transport | TESTED_WITH_UNIT | Unit/integration | Test suite | Untuk pengembangan |
| Length-prefixed frame codec | TESTED_WITH_UNIT | Unit | `tests/frame-codec.test.ts` | Codec penelitian, bukan klaim format live |
| Binary-node research codec | TESTED_WITH_UNIT | Unit | `tests/binary-node.test.ts` | JSON deterministic internal |
| AES-256-GCM storage | TESTED_WITH_UNIT | Unit | `tests/encrypted-file-store.test.ts` | Atomic encrypted file |
| SQLite session store | TESTED_WITH_UNIT | Unit | `tests/sqlite-store.test.ts` | `node:sqlite` |
| MySQL/MariaDB/PostgreSQL adapter | NOT_STARTED | None | Contract only | Driver production belum dipilih |
| Mock pairing lifecycle | TESTED_WITH_MOCK | Integration | `tests/integration/gateway.test.ts` | QR bukan QR layanan live |
| Live QR pairing | BLOCKED | None | None | Endpoint/schema/handshake belum tervalidasi |
| Mock outbound text | TESTED_WITH_MOCK | Integration | Gateway integration | Tidak mengirim ke jaringan live |
| Live outbound text | BLOCKED | None | None | Protokol belum tervalidasi |
| Live inbound text | BLOCKED | None | None | Protokol belum tervalidasi |
| REST API | TESTED_WITH_MOCK | Integration | Gateway integration | Auth, validation, rate limit |
| WebSocket event server | IMPLEMENTED | Type-check | Source | Outbound JSON events |
| Webhook HMAC | TESTED_WITH_UNIT | Unit | `tests/webhook-signing.test.ts` | Replay tolerance dan retry |
| CLI | IMPLEMENTED | Build | Source | Menggunakan gateway API |
| Media | NOT_STARTED | None | None | Setelah pesan teks live stabil |
| Live E2E | NOT_STARTED | None | None | Disabled by default |

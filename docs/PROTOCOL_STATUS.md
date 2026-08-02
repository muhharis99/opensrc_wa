# Protocol Status

| Fitur | Status | Pengujian | Bukti | Catatan |
|---|---|---|---|---|
| Core state machine | TESTED_WITH_UNIT | Unit | `tests/state-machine.test.ts` | Lifecycle internal |
| Typed events | TESTED_WITH_MOCK | Integration | Gateway tests | Runtime event bus |
| Generic WebSocket transport | IMPLEMENTED | Type-check | Source | Bukan endpoint layanan live |
| Mock transport | TESTED_WITH_UNIT | Unit/integration | Test suite | Pengembangan deterministik |
| Frame dan binary-node research codec | TESTED_WITH_UNIT | Unit | Protocol tests | Format internal, bukan klaim live |
| AES-256-GCM storage | TESTED_WITH_UNIT | Unit | Store tests | Atomic encrypted file |
| SQLite session store | TESTED_WITH_UNIT | Unit | SQLite test | `node:sqlite` |
| MySQL/MariaDB/PostgreSQL adapter | NOT_STARTED | None | Contract only | Driver belum dipilih |
| Mock QR pairing | TESTED_WITH_MOCK | Integration | Gateway tests | Bukan QR WhatsApp |
| Mock pairing code | TESTED_WITH_MOCK | Integration | Feature-parity test | Bukan pairing code WhatsApp |
| Mock session snapshot | TESTED_WITH_UNIT | Unit | `tests/session-snapshot.test.ts` | Tidak membawa credential live |
| Text/reply/forward/reaction/edit/delete | TESTED_WITH_MOCK | Unit/integration | Advanced messaging tests | Runtime mock |
| Receipt dan incoming fixture | TESTED_WITH_MOCK | Unit/integration | Advanced messaging tests | Runtime mock |
| Media pipeline | TESTED_WITH_MOCK | Unit/integration | Media dan gateway tests | Encrypted in-memory store |
| Chat/contact/group/presence | TESTED_WITH_MOCK | Unit/integration | Domain tests | Runtime mock |
| Status/channel/community | TESTED_WITH_MOCK | Unit/integration | Domain tests | Runtime mock |
| Business/catalog/labels/calls/privacy | TESTED_WITH_MOCK | Unit | Extended domain test | Runtime mock |
| History snapshot | TESTED_WITH_MOCK | Unit | Extended domain test | Bukan live history sync |
| REST API | TESTED_WITH_MOCK | Integration | Gateway tests | API key dan rate limit |
| WebSocket event server | IMPLEMENTED | Type-check | Source | JSON event stream |
| Webhook HMAC | TESTED_WITH_UNIT | Unit | Webhook test | Retry dan replay tolerance |
| CLI, SDK, plugins, dashboard | TESTED_WITH_UNIT | Unit/build | Source dan tests | Developer tooling |
| Live handshake | BLOCKED | None | `docs/PROTOCOL_RESEARCH.md` | Endpoint/schema belum tervalidasi |
| Live QR/pairing code | BLOCKED | None | None | Handshake belum tervalidasi |
| Live text/media exchange | BLOCKED | None | None | Protocol belum tervalidasi |
| Live history/app-state sync | BLOCKED | None | None | Protocol belum tervalidasi |
| Live E2E | NOT_STARTED | None | None | Disabled by default |

# Architecture

`opensrc_wa` menggunakan monorepo TypeScript strict dengan pemisahan berikut.

## Applications

- `apps/gateway`: HTTP, WebSocket, auth, rate limit, routing, metrics.
- `apps/cli`: command-line client untuk gateway.
- `apps/dashboard`: local no-CDN dashboard.

## Foundation packages

- `core`: errors, state machine, typed events, retry, validation, idempotency, deduplication.
- `transport`: WebSocket abstraction, mock transport, reconnect policy.
- `protocol`: frame codec, binary-node research codec, request correlation.
- `crypto`: secure random, SHA-256, HMAC, HKDF, AES-256-GCM.
- `auth`: pairing controller dan session manager.
- `session-store`: encrypted file, SQLite, relational adapter contract.

## Feature runtime

- `capabilities`: feature registry dan status.
- `messaging`: message lifecycle dan advanced message operations.
- `media`: encrypted mock media pipeline.
- `domain`: contacts, chats, groups, presence, status, channels, communities, business, labels, calls, privacy, history.
- `plugins`: safe in-process hooks.
- `sdk`: typed gateway client.

## Integration packages

- `api-contract`: OpenAPI document.
- `webhook`: HMAC signing, retry, dead-letter history.
- `observability`: structured logger, redaction, metrics.
- `testkit`: deterministic test helpers.

## Runtime boundary

Mock runtime menjalankan domain behavior tanpa network protokol live. Protocol live berada di balik boundary transport/protocol/crypto dan tetap `BLOCKED` sampai riset clean-room menghasilkan bukti yang dapat direproduksi.

## Data ownership

Session credential dan key hanya boleh berada pada `SessionStore`. Domain service pada versi 0.2 menggunakan in-memory state untuk mock development. Production persistence akan menggunakan adapter repository terpisah.

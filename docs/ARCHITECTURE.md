# Architecture

`opensrc_wa` menggunakan monorepo TypeScript strict dan arsitektur multi-provider.

## Applications

- `apps/gateway`: runtime mock, HTTP, WebSocket, auth, rate limit, routing, dan metrics.
- `apps/live-gateway`: REST API live-provider pada port terpisah agar runtime mock tetap stabil.
- `apps/cli`: command-line client.
- `apps/dashboard`: local no-CDN dashboard.

## Provider boundary

- `provider-contract`: kontrak netral `WhatsAppProvider` dan `ProviderManager`.
- `provider-baileys`: adapter live Baileys yang diisolasi.
- `mock`: behavior deterministik yang telah ada pada service internal.
- `native`: jalur riset WebSocket/Noise/Signal masa depan.

Tipe internal provider tidak boleh keluar ke API publik. Event dan request harus dipetakan menjadi contract `opensrc_wa`.

## Foundation packages

- `core`: errors, state machine, typed events, retry, validation, idempotency, deduplication.
- `transport`: WebSocket abstraction, mock transport, reconnect policy.
- `protocol`: frame codec, binary-node research codec, request correlation.
- `crypto`: secure random, SHA-256, HMAC, HKDF, AES-256-GCM.
- `auth`: pairing controller dan session manager mock.
- `session-store`: encrypted file, SQLite, relational adapter contract.

## Feature runtime

- `capabilities`: feature registry dan status.
- `messaging`: message lifecycle dan advanced message operations mock.
- `media`: encrypted mock media pipeline.
- `domain`: contacts, chats, groups, presence, status, channels, communities, business, labels, calls, privacy, history.
- `plugins`: safe in-process hooks.
- `sdk`: typed gateway client.

## Live provider runtime

`apps/live-gateway` membuat satu provider instance per `sessionId` melalui `ProviderManager`. Credential setiap session disimpan terpisah di direktori auth provider. Adapter memetakan:

- connection update dan QR;
- pairing code;
- credential update;
- incoming message dan message update;
- presence;
- contact/chat update;
- group participant dan metadata update;
- call dan history event.

Reconnect menggunakan exponential backoff dan berhenti pada logout, conflict, atau disconnect manual.

## Integration packages

- `api-contract`: OpenAPI document untuk gateway mock.
- `webhook`: HMAC signing, retry, dead-letter history.
- `observability`: structured logger, redaction, metrics.
- `testkit`: deterministic test helpers.

## Data ownership

Credential live hanya boleh berada di auth repository provider. Utility multi-file digunakan untuk bootstrap dan instalasi kecil. Untuk deployment besar, gunakan database-backed key repository, distributed locking, dan encryption at rest.

Domain service mock versi 0.2 masih menggunakan in-memory state. Production persistence tetap menjadi adapter repository terpisah.

## Security boundary

- API key wajib untuk seluruh endpoint live selain health/readiness.
- Live gateway memakai rate limit terpisah.
- QR, pairing code, auth keys, raw message, dan media tidak boleh ditulis ke log publik.
- Webhook memakai HMAC, retry terbatas, dan dead-letter history.
- Provider live hanya digunakan untuk akun/perangkat sendiri dan penerima yang memberikan persetujuan.

Lihat `docs/adr/0001-multi-provider-baileys.md`.

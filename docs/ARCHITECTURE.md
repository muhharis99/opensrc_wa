# Architecture

`opensrc_wa` menggunakan monorepo TypeScript strict dan arsitektur multi-provider.

## Applications

- `apps/gateway`: runtime mock, HTTP, WebSocket, auth, rate limit, routing, dan metrics.
- `apps/live-gateway`: REST API dan dashboard live-provider pada port terpisah.
- `apps/cli`: command-line client.
- `apps/dashboard`: dashboard runtime mock.

## Provider boundary

- `provider-contract`: `WhatsAppProvider`, `ProviderManager`, outbound pacing queue, dan session lease contract.
- `provider-baileys`: adapter live terisolasi, SQLite auth state, dan SQLite session lease.
- `provider-native`: boundary riset WebSocket/Noise/Signal yang menolak live operation tanpa bukti clean-room.
- runtime mock: behavior deterministik yang telah ada pada service internal.

Tipe internal provider tidak boleh keluar ke API publik. Event dan request harus dipetakan menjadi contract `opensrc_wa`.

## Foundation packages

- `core`: errors, state machine, typed events, retry, validation, idempotency, deduplication.
- `transport`: WebSocket abstraction, mock transport, reconnect policy.
- `protocol`: frame codec, binary-node research codec, request correlation.
- `crypto`: secure random, SHA-256, HMAC, HKDF, AES-256-GCM.
- `auth`: pairing controller dan session manager mock.
- `session-store`: encrypted file, SQLite, relational adapter contract.
- `qr`: QR PNG/Base64/data URL rendering.
- `object-store`: streaming object persistence contract dan local atomic implementation.

## Live provider lifecycle

```text
HTTP connect request
       |
ProviderManager.get(sessionId)
       |
SessionLeaseLock.acquire
       |
AuthState load (multi-file atau SQLite)
       |
BaileysProvider socket
       |
ProviderEvent -> session view -> webhook/dashboard
```

Session lease diperbarui periodik. Logout dan disconnect melepaskan lease serta menutup auth database handle. Proses kedua yang memakai session sama ditolak dengan `SESSION_LOCKED`.

## Outbound delivery

```text
REST message request
       |
validation
       |
PacedOutboundQueue
  - partition: sessionId
  - secondary delay: chatId
  - bounded pending capacity
       |
WhatsAppProvider.send
```

Queue in-process menjaga urutan per session. Deployment multi-node harus menggantinya dengan durable broker yang mempertahankan partition key dan idempotency.

## Media pipeline

```text
provider encrypted media
       |
downloadMediaMessage(stream)
       |
ObjectStore.put(stream)
       |
atomic local object + SHA-256 metadata
       |
authenticated streaming download
```

Local object store cocok untuk satu host. Horizontal scaling memerlukan S3-compatible storage atau backend object-store lain.

## Interactive dan broadcast

Buttons dan list dibuat pada adapter melalui provider low-level message generation, kemudian direlay. Keduanya diberi status `EXPERIMENTAL`. Broadcast mendukung JID broadcast/status yang sudah tersedia pada akun; repository tidak mengklaim pembuatan broadcast list baru.

Delete-for-everyone memakai message revoke, sedangkan delete-for-me memakai chat modification lokal dengan message key dan timestamp.

## Native provider

`provider-native` memodelkan evidence gates untuk endpoint, handshake, Noise, dan Signal. Tanpa seluruh bukti, `connect()` menghasilkan `NATIVE_PROTOCOL_BLOCKED`. Tidak ada fallback native diam-diam dan tidak ada detail protokol yang dikarang.

## Integration packages

- `api-contract`: OpenAPI document untuk gateway mock.
- `webhook`: HMAC signing, retry, dead-letter history.
- `observability`: structured logger, redaction, metrics.
- `testkit`: deterministic test helpers.

## Data ownership

- QR dan pairing code hanya berada pada memory session view dan tidak boleh dilog.
- Credential live berada pada auth repository provider.
- SQLite auth database dan local object store berada di `runtime` serta tidak boleh di-commit.
- API key disimpan sebagai SHA-256 digest.
- Dashboard hanya menyimpan API key di browser `sessionStorage`.

## Security boundary

- API key wajib untuk endpoint live selain health/readiness/dashboard shell.
- QR PNG endpoint tetap membutuhkan API key.
- Live gateway memakai HTTP rate limit dan outbound pacing terpisah.
- Webhook memakai HMAC, retry terbatas, dan dead-letter history.
- Provider digunakan hanya untuk akun/perangkat sendiri dan penerima yang memberikan persetujuan.

Lihat `docs/adr/0001-multi-provider-baileys.md`, `docs/AUTH_STORAGE.md`, `docs/OUTBOUND_QUEUE.md`, dan `docs/OBJECT_STORAGE.md`.

# Testing

```bash
pnpm typecheck
pnpm test
```

Coverage perilaku mencakup state transition, frame boundary, malformed input, AES-GCM, atomic encrypted storage, SQLite transaction, HMAC verification, redaction, number masking, idempotency, deduplication, API authentication, dan mock lifecycle.

Live E2E hanya boleh manual dengan akun/perangkat sendiri dan `ENABLE_LIVE_E2E=true`. Live E2E tidak boleh berjalan di CI publik.

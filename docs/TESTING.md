# Testing

Jalankan:

```bash
pnpm test
```

Suite versi 0.2 mencakup 30 pengujian:

- state machine;
- codec dan malformed input;
- cryptography;
- encrypted file dan SQLite stores;
- idempotency dan deduplication;
- redaction dan rate limiting;
- webhook signing;
- capability registry;
- advanced messaging;
- media pipeline;
- contacts, chats, groups, presence, status, channels, communities;
- business catalog, labels, calls, privacy, history;
- session snapshot;
- plugin hooks dan SDK;
- gateway lifecycle dan feature-parity integration.

Live E2E tidak berjalan pada CI publik:

```env
ENABLE_LIVE_E2E=false
```

Status `LIVE_TESTED` tidak boleh digunakan berdasarkan mock, fixture, interface, atau unit test.

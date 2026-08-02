# Testing

## Automated suite

```bash
pnpm test
```

Suite mencakup:

- state machine, retry, idempotency, deduplication, dan validation;
- codec, malformed input, cryptography, encrypted file store, dan SQLite store;
- messaging, media, contacts, chats, groups, presence, status, channels, communities, catalog, labels, calls, privacy, dan history;
- API authentication, rate limiting, webhook signing, SDK, plugin hooks, dan gateway integration;
- Baileys provider boundary menggunakan fake module tanpa koneksi live;
- QR PNG/Base64/data URL;
- SQLite provider auth credentials dan key state;
- session lease acquire, renew, conflict, dan release;
- outbound queue capacity dan pacing;
- streaming local object store dan integrity metadata;
- buttons, list, broadcast, delete-for-me, serta delete-for-everyone mapping;
- native-provider blocker yang memastikan detail protokol tidak dikarang.

Jalankan validasi penuh:

```bash
pnpm validate
pnpm build
```

## Live E2E

Live E2E tidak berjalan pada CI publik:

```env
ENABLE_LIVE_E2E=false
```

Pengujian manual hanya boleh menggunakan akun, perangkat, dan penerima milik sendiri atau yang telah memberi izin:

```bash
ENABLE_LIVE_E2E=true \
LIVE_E2E_API_KEY=... \
LIVE_E2E_RECIPIENT=628xxxxxxxxxx@s.whatsapp.net \
pnpm test:live
```

Baca `docs/LIVE_E2E.md` sebelum menjalankan. Harness dapat membuktikan connect dan send apabila provider mengembalikan message ID. Receive, delivered, dan read harus memiliki bukti terpisah dari webhook atau perangkat pengujian.

Status `LIVE_TESTED` tidak boleh digunakan berdasarkan mock, fixture, interface, fake provider, unit test, atau keberhasilan TypeScript build.

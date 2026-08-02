# Mock Runtime

Mock runtime menyediakan perilaku deterministik untuk pengembangan aplikasi, CI, contract test, webhook test, dan integrasi PHP tanpa terhubung ke layanan live.

## Jaminan

- Tidak mengirim traffic protokol WhatsApp.
- Tidak menghasilkan credential live.
- QR dan pairing code hanya challenge internal.
- Semua media disimpan secara in-memory dan dienkripsi menggunakan key runtime.
- Session persistence menggunakan encrypted file atau SQLite.
- Event memiliki ID dan timestamp.
- Message send memiliki idempotency dan deduplication.
- Pengiriman dapat ditolak bila kontak diblokir atau consent dicabut.

## Penggunaan

```env
OPEN_SRC_WA_PROTOCOL_MODE=mock
```

Buat session, mulai pairing, selesaikan pairing mock, lalu gunakan endpoint domain.

## Incoming fixture

Endpoint berikut membuat event pesan masuk tanpa network live:

```text
POST /api/v1/messages/mock-incoming
```

Endpoint ini hanya tersedia pada mode mock.

## Batasan

Mock runtime menguji kontrak dan logika aplikasi, bukan kompatibilitas protokol jaringan. Hasil mock tidak boleh digunakan sebagai bukti `LIVE_TESTED`.

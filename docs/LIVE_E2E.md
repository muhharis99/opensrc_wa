# Live E2E dengan Akun dan Perangkat Milik Sendiri

Live E2E tidak dijalankan pada CI publik karena membutuhkan QR atau pairing code dan akun WhatsApp nyata. Pengujian hanya boleh dilakukan menggunakan akun, nomor, perangkat, dan penerima yang Anda miliki atau yang telah memberikan izin.

## Persiapan

Jalankan live gateway:

```bash
pnpm install --frozen-lockfile
pnpm build
set -a
. ./.env
set +a
pnpm start:live
```

Isi environment berikut pada terminal pengujian:

```env
ENABLE_LIVE_E2E=true
LIVE_E2E_BASE_URL=http://127.0.0.1:3001
LIVE_E2E_API_KEY=api-key-asli
LIVE_E2E_SESSION_ID=live-e2e
LIVE_E2E_PAIRING_PHONE=
LIVE_E2E_RECIPIENT=628xxxxxxxxxx@s.whatsapp.net
LIVE_E2E_TIMEOUT_MS=180000
```

`LIVE_E2E_PAIRING_PHONE` boleh dikosongkan untuk QR. Jika diisi, gunakan nomor dengan kode negara dan hanya digit.

## Menjalankan

```bash
pnpm test:live
```

Pada mode QR, file sensitif sementara ditulis ke:

```text
runtime/live-e2e-qr.png
```

Scan QR menggunakan menu Linked Devices pada perangkat WhatsApp milik Anda. Script menunggu session menjadi `connected`, lalu mengirim pesan unik ke `LIVE_E2E_RECIPIENT`.

## Kriteria lulus

Script hanya menyatakan `LIVE_SEND_PASSED` apabila provider mengembalikan message ID dari pengiriman live. Penerimaan pesan tidak otomatis diklaim lulus. Verifikasi penerimaan harus dilakukan melalui webhook atau balasan manual dan dicatat sebagai bukti terpisah.

## Bukti yang boleh disimpan

- timestamp;
- versi commit;
- versi provider;
- session ID non-rahasia;
- message ID;
- hasil delivered/read tanpa isi percakapan pribadi.

Jangan menyimpan QR, pairing code, credential directory, API key, isi pesan pribadi, atau auth database ke issue, log publik, screenshot, maupun layanan AI.

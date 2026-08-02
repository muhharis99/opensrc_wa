# Native WebSocket / Noise / Signal Provider

Status saat ini: **BLOCKED**.

Paket `packages/provider-native` menyediakan boundary provider dan status machine-readable, tetapi tidak membuka koneksi live. Endpoint:

```text
GET /api/v1/live/native/status
```

Implementasi live tidak boleh diaktifkan hanya berdasarkan tebakan, source salinan, token hasil ekstraksi, atau konstanta dari library lain. Sebelum status berubah, seluruh bukti berikut harus tersedia dari riset clean-room yang legal:

1. endpoint dan lifecycle koneksi tervalidasi;
2. framing WebSocket tervalidasi menggunakan akun/perangkat pengujian sendiri;
3. handshake Noise tervalidasi dan memiliki test vector;
4. lifecycle identity/session/pre-key Signal tervalidasi dan memiliki test vector;
5. pairing dan credential persistence dapat direproduksi;
6. disconnect/reconnect/logout tervalidasi;
7. media encryption/decryption tervalidasi;
8. live E2E dijalankan pada akun milik sendiri;
9. security review dan responsible-use review selesai.

Tidak ada endpoint, schema, key, constant, atau handshake WhatsApp yang dikarang dalam repository. Jalur native dipertahankan sebagai target riset jangka panjang dan tidak menjadi fallback diam-diam ketika Baileys gagal.

# Architecture

`opensrc_wa` memisahkan transport, protocol, crypto orchestration, authentication, persistence, messaging, API, webhook, dan observability.

## Data flow

1. Gateway menerima request yang sudah diautentikasi dan divalidasi.
2. Session manager menjalankan state machine dan menyimpan perubahan secara atomik.
3. Transport hanya menangani koneksi/frame dan tidak mengetahui database atau API.
4. Protocol layer mengenkode, mendekode, dan mengorelasikan request.
5. Crypto provider memakai primitive Node.js/OpenSSL; key tidak dicatat.
6. Messaging menjaga idempotency dan duplicate suppression.
7. Typed event diteruskan ke WebSocket hub serta webhook service.
8. Logger meredaksi secret, isi pesan, dan nomor telepon.

Mode `mock` menguji seluruh orchestration tanpa koneksi layanan eksternal. Mode `research` menolak koneksi live sampai bukti protokol tersedia.

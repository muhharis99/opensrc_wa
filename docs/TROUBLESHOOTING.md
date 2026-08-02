# Troubleshooting

## Gateway tidak mulai

Periksa `OPEN_SRC_WA_API_KEY_SHA256` dan `OPEN_SRC_WA_SESSION_KEY`; keduanya harus 64 karakter hex.

## API 401

Kirim API key asli pada `X-API-Key`, bukan hash SHA-256.

## Session gagal connect pada mode research

Ini perilaku fail-closed. Status live masih `BLOCKED`.

## QR tidak tersedia

Panggil endpoint connect dahulu. Challenge mock memiliki waktu kedaluwarsa.

## SQLite warning

Runtime Node yang dipakai masih menandai `node:sqlite` eksperimental. Gunakan encrypted file store apabila kebijakan production tidak mengizinkannya.

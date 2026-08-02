# Protocol Research

## Tujuan

Mendokumentasikan observasi interoperabilitas yang diperoleh secara sah tanpa menyalin source code proyek lain.

## Metode yang diperbolehkan

- dokumentasi publik;
- standar WebSocket, Protocol Buffers, dan kriptografi publik;
- observasi black-box menggunakan akun/perangkat sendiri;
- fixture teranonimkan dengan provenance;
- perilaku eksternal yang dapat direproduksi.

## Blocker saat ini

Endpoint live, negosiasi versi, schema stanza, binary token dictionary, handshake, derivasi credential, pairing QR, dan lifecycle message live belum memiliki bukti cukup. Semua bagian tersebut tetap `BLOCKED`.

## Template catatan penelitian

- tanggal dan commit;
- lingkungan uji;
- akun/perangkat milik sendiri;
- input yang diberikan;
- output eksternal yang diamati;
- packet/fixture yang sudah dianonimkan;
- hipotesis terpisah dari fakta;
- risiko hukum, keamanan, dan kompatibilitas;
- langkah reproduksi.

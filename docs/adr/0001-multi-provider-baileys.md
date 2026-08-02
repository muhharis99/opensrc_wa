# ADR 0001 — Multi-provider dengan Baileys sebagai provider live pertama

Status: diterima

Tanggal: 2026-08-03

## Konteks

Versi 0.2 memiliki runtime mock yang luas, tetapi tidak memiliki koneksi WhatsApp live. Implementasi native WebSocket, Noise, Signal, app-state sync, dan perubahan protokol membutuhkan riset panjang serta pemeliharaan berkelanjutan.

## Keputusan

`opensrc_wa` memakai provider abstraction:

- `mock`: default untuk development, test, demo, dan CI;
- `baileys`: provider live pertama;
- `native`: placeholder untuk implementasi clean-room masa depan.

Baileys ditempatkan di adapter terisolasi. Tipe Baileys tidak menjadi bagian dari REST API, SDK publik, event contract, atau domain model `opensrc_wa`.

## Konsekuensi

Positif:

- QR, pairing code, session restore, send/receive, media, presence, kontak, dan grup dapat dikembangkan lebih cepat;
- runtime mock dan test lama tetap dipertahankan;
- provider dapat diganti tanpa mengubah API publik;
- migrasi menuju provider native tetap memungkinkan.

Negatif:

- provider live mengikuti breaking change dan stabilitas Baileys;
- penggunaan tetap unofficial dan memiliki risiko pemblokiran akun;
- auth state produksi tidak boleh bergantung permanen pada utility multi-file; adapter repository/database diperlukan untuk skala besar;
- fitur tertentu dapat berubah atau dihentikan oleh WhatsApp.

## Batasan

- Tidak ada spam, scraping nomor, stalkerware, account farming, ban evasion, atau pengiriman tanpa persetujuan.
- Live E2E hanya dijalankan dengan akun dan perangkat milik sendiri.
- Version provider dikunci dan harus melewati dependency, license, dan vulnerability review.

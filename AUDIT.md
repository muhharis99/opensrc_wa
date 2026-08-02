# Audit Repository opensrc_wa

Tanggal audit: 2026-08-03

## Ringkasan

`opensrc_wa` adalah monorepo Node.js 22 dan TypeScript strict dengan pnpm. Struktur sudah modular: aplikasi gateway, CLI, dashboard, serta paket core, transport, protocol, crypto, auth, session-store, messaging, media, domain, webhook, SDK, plugin, observability, dan testkit.

## Pendekatan koneksi sebelum perubahan ini

- Runtime utama adalah mock/fixture-first.
- Terdapat generic WebSocket abstraction dan codec penelitian, tetapi belum ada endpoint WhatsApp live yang tervalidasi.
- Tidak menggunakan browser automation.
- Tidak menggunakan library gateway eksternal.
- QR, pairing code, pesan, media, receipt, kontak, grup, status, channel, dan fitur lain berfungsi pada mock runtime, bukan akun WhatsApp nyata.

## Kualitas kode

Kekuatan:

- monorepo modular;
- TypeScript strict;
- typed events dan error model terpusat;
- REST API, WebSocket event stream, webhook, CLI, SDK, dashboard;
- encrypted file store dan SQLite;
- unit/integration test serta dokumentasi yang cukup lengkap.

Kekurangan:

- protokol live belum tersedia;
- domain runtime masih dominan in-memory;
- gateway routing perlu terus dipecah menjadi modul;
- rate limit HTTP belum sama dengan outbound message queue per session;
- paket root masih private dan belum menjadi paket npm publik;
- live E2E belum tersedia.

## Keputusan arsitektur

Mulai versi 0.3, proyek menggunakan arsitektur multi-provider:

1. `mock` untuk pengembangan deterministik dan CI;
2. `baileys` sebagai provider live pertama melalui adapter terisolasi;
3. `native` sebagai jalur riset WebSocket clean-room di masa depan.

Baileys tidak boleh bocor ke kontrak API publik. Semua akses dilakukan melalui `WhatsAppProvider`, sehingga provider dapat diganti tanpa mengubah gateway dan business service.

Lihat `docs/adr/0001-multi-provider-baileys.md`.

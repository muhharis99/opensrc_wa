# Dependency Policy

`opensrc_wa` menggunakan dependency sesedikit mungkin dan mengisolasi dependency provider live dari kontrak publik.

Toolchain dikunci:

- Node.js `22.16.0`;
- pnpm `10.14.0`;
- TypeScript `5.8.3`.

## Provider live yang diizinkan

- `@whiskeysockets/baileys` hanya boleh digunakan di `packages/provider-baileys` dan test adapter terkait.
- Versi harus exact, bukan rentang semver.
- Adapter tidak boleh mengekspor tipe internal Baileys sebagai API publik.
- Pemanggilan provider harus melewati `WhatsAppProvider`.
- Dependency harus melewati license review, vulnerability review, secret scan, dan automated test.

## Dependency yang tetap dilarang

Venom Bot, `whatsapp-web.js`, WPPConnect, open-wa, fork gateway lain, wrapper tersembunyi, Puppeteer, Playwright, Selenium, Chromium automation, serta source code yang disalin dari proyek lain tidak boleh digunakan.

## Aturan penambahan dependency

Dependency baru wajib memiliki:

1. alasan teknis;
2. versi exact;
3. lisensi yang kompatibel;
4. vulnerability review;
5. owner paket yang jelas;
6. test untuk boundary adapter;
7. dokumentasi fallback ketika dependency tidak tersedia.

Runtime mock harus tetap dapat diuji tanpa koneksi WhatsApp live. Live E2E dinonaktifkan secara default pada CI publik.

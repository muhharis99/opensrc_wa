# Dependency Policy

Bootstrap `0.1.0` memiliki **zero application dependency**. Runtime memakai Node.js standard library dan primitive OpenSSL yang disediakan Node.

Toolchain dikunci:

- Node.js `22.16.0`;
- pnpm `10.14.0`;
- TypeScript `5.8.3`.

Lint dan format bootstrap memakai pemeriksaan deterministik tanpa dependency registry. Integrasi ESLint dan Prettier resmi direncanakan setelah registry tersedia dan lockfile dapat dihasilkan serta diverifikasi.

Dependency gateway siap pakai seperti Baileys, Venom Bot, `whatsapp-web.js`, WPPConnect, open-wa, atau browser automation tidak boleh ditambahkan sebagai dependency, wrapper, child process, container, test helper, atau fallback.

Dependency baru wajib memiliki alasan, versi exact, lisensi, vulnerability review, dan bukti bahwa dependency tidak menyediakan konektivitas WhatsApp siap pakai.

# Auth Storage dan Session Lease

## Multi-file

Mode kompatibilitas:

```env
OPEN_SRC_WA_BAILEYS_AUTH_STORE=multi-file
OPEN_SRC_WA_BAILEYS_AUTH_DIR=./runtime/baileys-auth
```

Setiap session memiliki folder credential terpisah. Mode ini cocok untuk development dan instalasi kecil, tetapi jumlah file bertambah cepat ketika signal keys berubah.

## SQLite

Mode database:

```env
OPEN_SRC_WA_BAILEYS_AUTH_STORE=sqlite
OPEN_SRC_WA_BAILEYS_AUTH_DATABASE=./runtime/baileys-auth.sqlite
```

Adapter menyimpan credential dan key state dalam tabel `provider_auth_state`. Update key memakai transaksi `BEGIN IMMEDIATE`, WAL, busy timeout, dan primary key per session/category/key.

Database mengandung credential jangka panjang. Perlakukan seperti private key:

- jangan commit;
- jangan masukkan ke Docker image;
- batasi permission file;
- enkripsi volume atau disk;
- buat backup terenkripsi;
- jangan mengirimkannya ke issue, support chat, screenshot, atau layanan AI.

## Session lease

```env
OPEN_SRC_WA_SESSION_LEASE_DATABASE=./runtime/session-leases.sqlite
OPEN_SRC_WA_SESSION_LEASE_TTL_MS=30000
```

Sebelum membuka socket, provider mengambil lease eksklusif berdasarkan `sessionId`. Lease diperbarui periodik dan dilepas ketika logout/disconnect. Proses kedua yang mencoba memakai session yang sama menerima `SESSION_LOCKED`.

Implementasi SQLite melindungi beberapa proses yang berbagi database yang sama. Untuk deployment lintas server, gunakan adapter lease pada PostgreSQL/MySQL/Redis dengan semantik compare-and-set, TTL, owner token, fencing token, dan clock source yang konsisten. SQLite pada network filesystem tidak direkomendasikan sebagai distributed lock lintas node.

## Skala

SQLite mengurangi jumlah file auth dan sesuai untuk ratusan session pada satu host selama I/O, backup, dan busy timeout dipantau. Skala horizontal membutuhkan:

- database auth terpusat;
- distributed lease yang benar;
- encryption at rest;
- sharding session;
- per-session queue;
- observability terhadap key write latency dan lease loss.

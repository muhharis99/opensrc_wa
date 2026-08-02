# Auth Storage dan Session Lease

## Multi-file auth

```env
OPEN_SRC_WA_BAILEYS_AUTH_STORE=multi-file
OPEN_SRC_WA_BAILEYS_AUTH_DIR=./runtime/baileys-auth
```

Setiap session memiliki folder credential terpisah. Mode ini cocok untuk development dan instalasi kecil, tetapi jumlah file bertambah cepat ketika signal keys berubah.

## SQLite auth database

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

## SQLite lease untuk satu host

```env
OPEN_SRC_WA_SESSION_LEASE_DATABASE=./runtime/session-leases.sqlite
OPEN_SRC_WA_SESSION_LEASE_REDIS_URL=
OPEN_SRC_WA_SESSION_LEASE_TTL_MS=30000
```

Provider mengambil lease eksklusif berdasarkan `sessionId`, memperbaruinya periodik, dan melepaskannya saat logout/disconnect. Proses kedua menerima `SESSION_LOCKED`. SQLite sesuai untuk beberapa proses yang berbagi disk lokal yang sama, tetapi tidak direkomendasikan pada network filesystem.

## Redis distributed lease lintas host

```env
OPEN_SRC_WA_SESSION_LEASE_REDIS_URL=rediss://username:password@redis.example.com:6380/0
OPEN_SRC_WA_SESSION_LEASE_TTL_MS=30000
```

Jika Redis URL diisi, live gateway menggunakan distributed lease Redis dan mengabaikan SQLite lease path. Adapter menggunakan:

- `SET key owner NX PX ttl` untuk acquire;
- Lua compare-owner + `PEXPIRE` untuk renew;
- Lua compare-owner + `DEL` untuk release;
- UUID owner token untuk mencegah proses lama menghapus lease proses baru;
- `redis://` atau `rediss://`, AUTH, database selection, timeout, dan koneksi persisten per active session.

Redis harus memiliki persistence, authentication, TLS pada jaringan tidak tepercaya, monitoring latency, dan high availability. Lease loss menghasilkan provider error dan harus dianggap sebagai kondisi kritis. Untuk operasi yang mengubah resource eksternal secara non-idempotent, tambahkan fencing token di lapisan database/broker.

## Skala

SQLite auth mengurangi jumlah file dan sesuai untuk ratusan session pada satu host selama I/O, backup, dan busy timeout dipantau. Skala horizontal membutuhkan:

- auth database terpusat atau sharded;
- Redis/distributed lease;
- encryption at rest dan key rotation;
- durable queue dengan partition per session;
- external object storage;
- observability terhadap auth writes, lease renew/loss, queue latency, dan reconnect.

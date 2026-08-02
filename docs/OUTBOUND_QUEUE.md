# Outbound Queue dan Pacing

Live gateway mengantrekan setiap operasi kirim melalui `PacedOutboundQueue`.

```env
OPEN_SRC_WA_OUTBOUND_SESSION_INTERVAL_MS=750
OPEN_SRC_WA_OUTBOUND_CHAT_INTERVAL_MS=1250
OPEN_SRC_WA_OUTBOUND_MAX_PENDING=1000
```

Aturan:

- satu session diproses berurutan;
- pengiriman berikutnya menunggu interval minimum session;
- chat yang sama memiliki interval tambahan;
- queue menolak pekerjaan baru dengan `OUTBOUND_QUEUE_FULL` ketika kapasitas tercapai;
- statistik tersedia melalui `GET /api/v1/live/queue` dan daftar session.

Queue ini adalah guardrail teknis, bukan sarana menghindari pembatasan WhatsApp. Gunakan hanya untuk komunikasi yang diminta atau disetujui penerima. Jangan menaikkan throughput untuk spam, scraping, account farming, atau ban evasion.

Untuk deployment multi-node, pindahkan queue ke broker durable dan pertahankan partition key berdasarkan `sessionId`, lalu `chatId`. Tambahkan retry budget, dead-letter queue, circuit breaker, idempotency key, dan consent registry.

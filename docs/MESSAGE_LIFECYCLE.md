# Message Lifecycle

## Mock outbound

1. Request divalidasi.
2. Session harus `READY`.
3. Idempotency key diperiksa.
4. Message ID UUID dibuat.
5. Duplicate window memverifikasi event baru.
6. Record berstatus `sent` disimpan pada memory runtime.
7. Event `message.sent` dikirim ke WebSocket dan webhook.

Isi pesan tidak masuk structured log. Persistence message production dan receipt live belum tersedia.

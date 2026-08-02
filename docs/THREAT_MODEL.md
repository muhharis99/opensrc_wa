# Threat Model

| Ancaman | Dampak | Mitigasi saat ini | Sisa risiko |
|---|---|---|---|
| API key dicuri | Akses gateway | Hash, header auth, rate limit, log redaction | Distribusi secret di luar proses |
| Session file dicuri | Credential exposure | AES-256-GCM, permission 0600 | Master key di environment |
| Replay webhook | Event diproses ulang | Timestamp tolerance, delivery ID, dedupe guidance | Receiver wajib menyimpan delivery ID |
| Payload besar | Memory exhaustion | Request-size limit | Reverse proxy tetap disarankan |
| Retry tanpa batas | Traffic storm | Bounded retry, backoff, jitter | Distributed queue belum tersedia |
| Log bocor | Data pribadi/secret | Redaction dan phone masking | Custom logger contributor harus diaudit |
| Protocol drift | Session gagal/rusak | Versioned status, fail closed, BLOCKED live mode | Riset berkelanjutan diperlukan |
| Abuse messaging | Spam/ban | Consent policy, no blast features | Integrator tetap bertanggung jawab |

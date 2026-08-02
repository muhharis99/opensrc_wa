# Webhooks

Header:

```text
X-OpenSrc-WA-Event
X-OpenSrc-WA-Delivery
X-OpenSrc-WA-Timestamp
X-OpenSrc-WA-Signature
```

Canonical payload:

```text
timestamp + "." + delivery_id + "." + event + "." + raw_body
```

Signature:

```text
sha256=HEX_HMAC_SHA256(secret, canonical_payload)
```

Receiver harus memakai raw body, timing-safe comparison, tolerance waktu maksimal lima menit, dan unique constraint pada delivery ID. Delivery gagal dicoba ulang secara terbatas dengan exponential backoff; kegagalan akhir dicatat sebagai `dead-letter`.

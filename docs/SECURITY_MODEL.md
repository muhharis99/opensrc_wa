# Security Model

## Trust boundaries

- client API ke gateway;
- gateway ke session store;
- gateway ke webhook receiver;
- process ke filesystem/runtime volume;
- future transport ke layanan eksternal.

## Controls

- API key disimpan sebagai SHA-256 digest;
- timing-safe comparison;
- rate limit dan payload limit;
- validation per field;
- AES-256-GCM encrypted file store;
- atomic write dan SQLite transaction;
- HMAC webhook signature dan timestamp tolerance;
- idempotency serta duplicate suppression;
- non-root container, read-only filesystem, dropped capabilities;
- structured logging dengan redaction.

## Non-goals

Bootstrap ini belum menyediakan HSM, multi-tenant RBAC penuh, distributed lock, key management service, atau adapter database production.

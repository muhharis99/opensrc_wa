# API

OpenAPI JSON tersedia di `GET /openapi.json`.

## Authentication

Semua endpoint `/api/v1/*` membutuhkan:

```text
X-API-Key: API_KEY_ASLI
```

## Session

- `POST /api/v1/sessions`
- `GET /api/v1/sessions`
- `GET /api/v1/sessions/:sessionId`
- `DELETE /api/v1/sessions/:sessionId`
- `POST /api/v1/sessions/:sessionId/connect`
- `POST /api/v1/sessions/:sessionId/disconnect`
- `POST /api/v1/sessions/:sessionId/logout`
- `GET /api/v1/sessions/:sessionId/qr`
- `GET /api/v1/sessions/:sessionId/status`
- `POST /api/v1/sessions/:sessionId/mock-complete-pairing`

## Message

- `POST /api/v1/messages/text`
- `GET /api/v1/messages/:messageId`

## Webhook

- `POST /api/v1/webhooks`
- `GET /api/v1/webhooks`
- `DELETE /api/v1/webhooks/:webhookId`
- `GET /api/v1/webhooks/deliveries`

Response menggunakan envelope `success`, `data`, `error`, dan `meta` dengan request ID serta timestamp.

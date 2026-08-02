# API

OpenAPI JSON tersedia di `GET /openapi.json`.

## Authentication

Semua endpoint `/api/v1/*` membutuhkan:

```text
X-API-Key: API_KEY_ASLI
```

## Public

- `GET /health`
- `GET /ready`
- `GET /version`
- `GET /openapi.json`
- `GET /metrics`
- `GET /dashboard`

## Capability dan plugins

- `GET /api/v1/capabilities`
- `GET /api/v1/plugins`

## Session

- `POST /api/v1/sessions`
- `GET /api/v1/sessions`
- `GET /api/v1/sessions/:sessionId`
- `DELETE /api/v1/sessions/:sessionId`
- `POST /api/v1/sessions/import`
- `GET /api/v1/sessions/:sessionId/export`
- `POST /api/v1/sessions/:sessionId/connect`
- `POST /api/v1/sessions/:sessionId/disconnect`
- `POST /api/v1/sessions/:sessionId/logout`
- `GET /api/v1/sessions/:sessionId/qr`
- `POST /api/v1/sessions/:sessionId/pairing-code`
- `POST /api/v1/sessions/:sessionId/mock-complete-pairing`

## Messaging dan media

- `GET /api/v1/messages`
- `POST /api/v1/messages/text`
- `POST /api/v1/messages/media`
- `POST /api/v1/messages/location`
- `POST /api/v1/messages/contact`
- `POST /api/v1/messages/poll`
- `POST /api/v1/messages/mock-incoming`
- `GET|PATCH|DELETE /api/v1/messages/:messageId`
- `POST /api/v1/messages/:messageId/reactions`
- `POST /api/v1/messages/:messageId/forward`
- `POST /api/v1/messages/:messageId/receipts`
- `GET|POST /api/v1/media`
- `GET|DELETE /api/v1/media/:mediaId`

## Domain

- Contacts: `/api/v1/contacts`
- Chats: `/api/v1/chats`
- Groups: `/api/v1/groups`
- Presence: `/api/v1/presence`
- Status: `/api/v1/statuses`
- Channels: `/api/v1/channels`
- Communities: `/api/v1/communities`
- Business profile/catalog: `/api/v1/business/*`
- Labels: `/api/v1/labels`
- Calls: `/api/v1/calls`
- Privacy: `/api/v1/privacy`
- History: `/api/v1/history/*`

## Webhook dan events

- `GET|POST /api/v1/webhooks`
- `DELETE /api/v1/webhooks/:webhookId`
- `GET /api/v1/webhooks/deliveries`
- WebSocket upgrade: `/api/v1/events`

Response menggunakan envelope `success`, `data`, `error`, dan `meta`.

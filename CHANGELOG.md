# Changelog

## 0.4.0 — Durable Live Runtime

- Added QR rendering as PNG, Base64, and data URL, plus authenticated QR endpoints.
- Added a dedicated live session dashboard for connect, QR, status, disconnect, and logout.
- Added experimental interactive buttons and list message operations behind the provider adapter.
- Added native broadcast/status broadcast send support and broadcast-list information lookup for existing broadcast JIDs.
- Split delete behavior into delete-for-me and delete-for-everyone.
- Added SQLite-backed provider auth state for credentials and signal keys.
- Added session lease locking with owner tokens, TTL, renewal, and conflict rejection.
- Added bounded outbound queue and pacing per session and chat.
- Added streaming media download and local object-store persistence with SHA-256 integrity metadata.
- Added an opt-in live E2E harness for accounts and devices owned by the tester.
- Added an explicit native WebSocket/Noise/Signal provider boundary that remains `BLOCKED` without reproducible clean-room evidence.
- Expanded documentation for live API, live E2E, auth storage, queueing, object storage, and native-provider research gates.
- Added automated tests for QR, queueing, object storage, SQLite auth state, session leases, interactive messages, broadcast, delete scopes, and the native blocker.

## 0.3.0 — Multi-provider Live Gateway

- Added `AUDIT.md` and ADR 0001 documenting the move from clean-room-only to a multi-provider architecture.
- Added provider-neutral `WhatsAppProvider` contracts and a multi-session `ProviderManager`.
- Added an isolated Baileys adapter pinned to `@whiskeysockets/baileys@7.0.0-rc13`.
- Added QR and pairing-code event mapping, credential persistence, session restore, logout, conflict detection, and exponential reconnect.
- Added live send operations for text, mentions, reply/quote, image, video, audio, voice note, document, sticker, location, contact, poll, reaction, edit, delete, and forward.
- Added live event mapping for incoming messages, message updates, presence, contacts, chats, groups, calls, and history sync.
- Added live contact checks, block/unblock, profile updates, group creation/member/admin/settings/invite operations, and media download/decryption.
- Added authenticated live REST gateway on port `3001`, independent from the stable mock gateway.
- Added signed live webhook forwarding with bounded retry and dead-letter history.
- Added consent-aware auto-reply and throttled broadcast examples.
- Updated dependency policy to isolate Baileys and continue prohibiting browser automation, copied source, and unapproved gateway wrappers.
- Generated a reproducible pnpm lockfile and passed full validation with 32 automated tests.
- Live E2E remains opt-in and has not been claimed as completed without owned-account testing.

## 0.2.0 — Feature Runtime

- Added capability registry with machine-readable implementation status.
- Added mock QR and phone pairing-code lifecycle.
- Added advanced messaging: replies, forwards, reactions, edits, deletes, receipts, polls, locations, contacts, and incoming fixtures.
- Added encrypted mock media pipeline for image, video, audio, document, and sticker data.
- Added contact consent/blocking, chat management, group management, presence, status, channels, and communities.
- Added business profile/catalog, labels, mock call lifecycle, and privacy settings.
- Added history snapshots and mock session export/import.
- Added TypeScript SDK, safe plugin hooks, local dashboard, expanded CLI, REST API, and OpenAPI document.
- Expanded automated coverage to 30 unit and integration tests.
- Kept all native live protocol functions explicitly `BLOCKED` pending clean-room validation.

## 0.1.0 — Foundation

- Initial strict TypeScript monorepo.
- Core state machine, transport, codec, crypto, session storage, gateway, webhook, CLI, Docker, CI, and documentation.

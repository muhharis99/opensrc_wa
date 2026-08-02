# Release Status

## v0.4.0

- Publication status: implementation committed to `main`; final validation evidence is generated after the reproducible lockfile and Docker checks pass.
- Architecture: multi-provider with stable mock runtime, isolated Baileys live adapter, and an explicitly blocked native research provider.
- QR: provider payload, PNG, Base64, and data URL are implemented.
- Interactive messaging: buttons and list operations are implemented but remain `EXPERIMENTAL` pending live compatibility testing.
- Broadcast: existing broadcast JID and status broadcast operations are implemented; creation of new native broadcast lists is not claimed.
- Delete semantics: delete-for-me and delete-for-everyone use separate provider operations.
- Live dashboard: implemented on `/dashboard`.
- Auth persistence: multi-file and SQLite provider auth modes are implemented.
- Session ownership: SQLite lease with TTL and owner token is implemented for processes sharing the same database on one host.
- Outbound delivery: bounded queue with per-session and per-chat pacing is implemented.
- Media: Base64 compatibility and streaming object-store persistence are implemented.
- Live E2E: harness is implemented but no live result is claimed because this environment has no user-owned WhatsApp account/device pairing.
- Native WebSocket/Noise/Signal: provider contract and research gates are implemented; live connectivity remains `BLOCKED`.
- Distributed multi-node production status: requires a centralized database/lease adapter, durable broker, and external object storage before horizontal scaling.

## v0.3.0

- Publication status: published to `main`.
- Architecture: multi-provider with stable mock runtime and isolated Baileys live adapter.
- Provider dependency: `@whiskeysockets/baileys@7.0.0-rc13`, exact version, reproducible pnpm lockfile.
- Validation: lint, format check, strict TypeScript type-check, automated tests, documentation checks, dependency policy checks, and license checks passed in GitHub Actions.
- Automated tests: 32 passed, including provider boundary tests with a fake Baileys module.
- Live gateway: `apps/live-gateway`, default port `3001`, API-key protected, rate-limited, multi-session, webhook-enabled.
- Implemented adapter scope: QR, pairing code, credential save/restore, reconnect, text/media/message operations, incoming events, presence, contacts, chats, groups, profile, block/unblock, history/call events, and media download.
- Live E2E status: not claimed as completed. It remains opt-in and must use accounts/devices owned by the tester.
- Native WebSocket/Noise/Signal provider: remained research-only.

## v0.2.0

- Publication status: published to `main`.
- Runtime scope: broad clean-room mock and fixture feature parity.
- Validation: lint, format check, strict TypeScript type-check, build, documentation checks, dependency policy checks, license checks, and 30 automated tests passed.
- Gateway smoke test: `/health`, `/ready`, `/dashboard`, and `/api/v1/capabilities` passed; the capability registry exposes 41 records.
- Native live WhatsApp protocol remained `BLOCKED` pending clean-room validation.

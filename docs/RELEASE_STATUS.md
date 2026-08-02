# Release Status

## v0.3.0

- Publication status: published to `main`.
- Architecture: multi-provider with stable mock runtime and isolated Baileys live adapter.
- Provider dependency: `@whiskeysockets/baileys@7.0.0-rc13`, exact version, reproducible pnpm lockfile.
- Validation: lint, format check, strict TypeScript type-check, automated tests, documentation checks, dependency policy checks, and license checks passed in GitHub Actions.
- Automated tests: 32 passed, including provider boundary tests with a fake Baileys module.
- Live gateway: `apps/live-gateway`, default port `3001`, API-key protected, rate-limited, multi-session, webhook-enabled.
- Implemented adapter scope: QR, pairing code, credential save/restore, reconnect, text/media/message operations, incoming events, presence, contacts, chats, groups, profile, block/unblock, history/call events, and media download.
- Live E2E status: not claimed as completed. It remains opt-in and must use accounts/devices owned by the tester.
- Native WebSocket/Noise/Signal provider: still research-only and not implemented for production.
- Browser automation, copied source, and unapproved gateway wrappers remain prohibited.

## v0.2.0

- Publication status: published to `main`.
- Runtime scope: broad clean-room mock and fixture feature parity.
- Validation: lint, format check, strict TypeScript type-check, build, documentation checks, dependency policy checks, license checks, and 30 automated tests passed.
- Gateway smoke test: `/health`, `/ready`, `/dashboard`, and `/api/v1/capabilities` passed; the capability registry exposes 41 records.
- Native live WhatsApp protocol remained `BLOCKED` pending clean-room validation.

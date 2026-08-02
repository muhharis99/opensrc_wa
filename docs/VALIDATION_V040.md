# opensrc_wa v0.4.0 Validation Evidence

Validation source commit: `1d0e2754849036724992cbd131907471d6232ee7`

The following checks passed on GitHub-hosted Ubuntu:

- frozen dependency installation with pnpm 10.14.0;
- lint and format checks;
- strict TypeScript type-check;
- automated test suite (reported tests: 41);
- QR, SQLite auth, SQLite lease, Redis distributed lease, queue, object-store, interactive-message, broadcast, delete-scope, and native-blocker tests;
- documentation policy checks;
- dependency-boundary checks;
- license checks;
- TypeScript production build;
- Docker Compose configuration validation;
- Docker image build for `opensrc-wa:v0.4.0`.

Live WhatsApp E2E was not executed because it requires a user-owned account and device. Native WebSocket/Noise/Signal connectivity remains `BLOCKED` and was not fabricated.

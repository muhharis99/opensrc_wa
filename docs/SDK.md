# TypeScript SDK

Package `packages/sdk` menyediakan `OpenSrcWaClient` dengan API key authentication dan error handling envelope.

```ts
import { OpenSrcWaClient } from "@opensrc-wa/sdk";

const client = new OpenSrcWaClient({
  baseUrl: "http://localhost:3000",
  apiKey: process.env.OPEN_SRC_WA_API_KEY ?? ""
});

await client.createSession("utama");
await client.connectSession("utama");
await client.completeMockPairing("utama");
await client.sendText({
  sessionId: "utama",
  to: "6281234567890",
  text: "Halo",
  idempotencyKey: "sdk-0001"
});
```

SDK tidak menyimpan API key pada log dan dapat menerima custom `fetchImpl` untuk pengujian.

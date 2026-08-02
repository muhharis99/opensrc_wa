import { createLiveGateway } from "./server";
import { loadLiveGatewayConfig } from "./config";

async function main(): Promise<void> {
  const config = loadLiveGatewayConfig();
  const runtime = createLiveGateway(config);
  runtime.server.listen(config.port, config.host, () => {
    process.stdout.write(JSON.stringify({ level: "info", event: "live_gateway.started", host: config.host, port: config.port, provider: "baileys", timestamp: new Date().toISOString() }) + "\n");
  });

  const shutdown = async (signal: string): Promise<void> => {
    process.stdout.write(JSON.stringify({ level: "info", event: "live_gateway.stopping", signal, timestamp: new Date().toISOString() }) + "\n");
    await runtime.close();
    process.exit(0);
  };
  process.on("SIGINT", () => { void shutdown("SIGINT"); });
  process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
}

void main().catch((error) => {
  process.stderr.write(JSON.stringify({ level: "error", event: "live_gateway.failed", message: error instanceof Error ? error.message : String(error), timestamp: new Date().toISOString() }) + "\n");
  process.exit(1);
});

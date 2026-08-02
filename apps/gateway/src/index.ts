import { loadConfig } from "./config";
import { createGateway } from "./server";
import { JsonLogger } from "../../../packages/observability/src/logger";

async function main(): Promise<void> {
  const logger = new JsonLogger(process.env.NODE_ENV === "development" ? "debug" : "info");
  const config = loadConfig();
  const runtime = createGateway(config, { logger });
  runtime.server.listen(config.port, config.host, () => {
    logger.info("gateway.started", { host: config.host, port: config.port, protocol_mode: config.protocolMode, live_protocol: "BLOCKED" });
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info("gateway.shutdown", { signal });
    await runtime.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("uncaughtException", (error: Error) => { logger.error("process.uncaught_exception", { error: error.message }); void shutdown("uncaughtException"); });
  process.on("unhandledRejection", (error: unknown) => { logger.error("process.unhandled_rejection", { error: error instanceof Error ? error.message : "unknown" }); void shutdown("unhandledRejection"); });
}

void main();

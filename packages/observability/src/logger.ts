import { redact } from "./redaction";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export class JsonLogger implements Logger {
  public constructor(private readonly minimum: LogLevel = "info") {}

  public debug(message: string, context: Record<string, unknown> = {}): void { this.write("debug", message, context); }
  public info(message: string, context: Record<string, unknown> = {}): void { this.write("info", message, context); }
  public warn(message: string, context: Record<string, unknown> = {}): void { this.write("warn", message, context); }
  public error(message: string, context: Record<string, unknown> = {}): void { this.write("error", message, context); }

  private write(level: LogLevel, message: string, context: Record<string, unknown>): void {
    const order: LogLevel[] = ["debug", "info", "warn", "error"];
    if (order.indexOf(level) < order.indexOf(this.minimum)) return;
    const line = JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...redact(context) as Record<string, unknown> });
    if (level === "error" || level === "warn") process.stderr.write(`${line}\n`);
    else process.stdout.write(`${line}\n`);
  }
}

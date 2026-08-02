import type { ErrorCategory } from "./types";

export class OpenSrcWaError extends Error {
  public readonly code: string;
  public readonly category: ErrorCategory;
  public readonly details: Record<string, unknown>;
  public readonly retryable: boolean;

  public constructor(options: {
    code: string;
    category: ErrorCategory;
    message: string;
    details?: Record<string, unknown>;
    retryable?: boolean;
  }) {
    super(options.message);
    this.name = "OpenSrcWaError";
    this.code = options.code;
    this.category = options.category;
    this.details = options.details ?? {};
    this.retryable = options.retryable ?? false;
  }
}

export function asOpenSrcWaError(error: unknown): OpenSrcWaError {
  if (error instanceof OpenSrcWaError) return error;
  const message = error instanceof Error ? error.message : "Unknown error";
  return new OpenSrcWaError({
    code: "INTERNAL_ERROR",
    category: "CONFIGURATION_ERROR",
    message,
    retryable: false
  });
}

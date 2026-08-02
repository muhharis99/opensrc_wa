import { OpenSrcWaError } from "./errors";

export function requireString(value: unknown, field: string, options?: { min?: number; max?: number }): string {
  if (typeof value !== "string") throw validationError(field, "harus berupa string");
  const min = options?.min ?? 1;
  const max = options?.max ?? 4096;
  if (value.length < min || value.length > max) throw validationError(field, `panjang harus ${min}-${max}`);
  return value;
}

export function requireRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OpenSrcWaError({ code: "INVALID_JSON_BODY", category: "VALIDATION_ERROR", message: "Body JSON harus berupa objek" });
  }
  return value as Record<string, unknown>;
}

function validationError(field: string, message: string): OpenSrcWaError {
  return new OpenSrcWaError({
    code: "VALIDATION_ERROR",
    category: "VALIDATION_ERROR",
    message: `${field} ${message}`,
    details: { field }
  });
}

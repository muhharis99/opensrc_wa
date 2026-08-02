const sensitiveKeys = new Set([
  "authorization",
  "api_key",
  "apiKey",
  "token",
  "secret",
  "privateKey",
  "credential",
  "qr",
  "text",
  "message"
]);

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 7) return "***";
  return `${digits.slice(0, 4)}${"*".repeat(Math.max(3, digits.length - 7))}${digits.slice(-3)}`;
}

export function redact(value: unknown, keyHint = ""): unknown {
  if (sensitiveKeys.has(keyHint)) return "[REDACTED]";
  if (typeof value === "string") {
    if (/^\d{9,16}$/.test(value)) return maskPhone(value);
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) output[key] = redact(child, key);
    return output;
  }
  return value;
}

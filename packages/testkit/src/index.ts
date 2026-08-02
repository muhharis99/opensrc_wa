export function fixedClock(iso = "2026-01-01T00:00:00.000Z"): () => number {
  const value = Date.parse(iso);
  return () => value;
}

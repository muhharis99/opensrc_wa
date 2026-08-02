export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
}

export function calculateBackoff(attempt: number, policy: RetryPolicy, random = Math.random): number {
  const exponential = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** Math.max(0, attempt - 1));
  const jitter = exponential * policy.jitterRatio * (random() * 2 - 1);
  return Math.max(0, Math.round(exponential + jitter));
}

export async function retry<T>(
  operation: (attempt: number) => Promise<T>,
  policy: RetryPolicy,
  shouldRetry: (error: unknown) => boolean = () => true
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= policy.maxAttempts || !shouldRetry(error)) throw error;
      await new Promise<void>((resolve) => setTimeout(resolve, calculateBackoff(attempt, policy)));
    }
  }
  throw lastError;
}

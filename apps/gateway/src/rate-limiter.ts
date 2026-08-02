export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();
  public constructor(private readonly limit: number, private readonly windowMs: number, private readonly now: () => number = Date.now) {}

  public consume(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const current = this.now();
    let window = this.windows.get(key);
    if (!window || window.resetAt <= current) {
      window = { count: 0, resetAt: current + this.windowMs };
      this.windows.set(key, window);
    }
    window.count += 1;
    return { allowed: window.count <= this.limit, remaining: Math.max(0, this.limit - window.count), resetAt: window.resetAt };
  }
}

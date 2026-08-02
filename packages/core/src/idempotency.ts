export class IdempotencyStore<T> {
  private readonly values = new Map<string, { value: T; expiresAt: number }>();
  public constructor(private readonly ttlMs: number, private readonly now: () => number = Date.now) {}

  public get(key: string): T | undefined {
    const item = this.values.get(key);
    if (!item) return undefined;
    if (item.expiresAt <= this.now()) {
      this.values.delete(key);
      return undefined;
    }
    return item.value;
  }

  public set(key: string, value: T): void {
    this.values.set(key, { value, expiresAt: this.now() + this.ttlMs });
  }

  public size(): number {
    return this.values.size;
  }
}

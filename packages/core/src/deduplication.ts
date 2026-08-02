export class DeduplicationWindow {
  private readonly seen = new Map<string, number>();
  public constructor(private readonly ttlMs: number, private readonly now: () => number = Date.now) {}

  public accept(id: string): boolean {
    this.prune();
    if (this.seen.has(id)) return false;
    this.seen.set(id, this.now() + this.ttlMs);
    return true;
  }

  private prune(): void {
    const current = this.now();
    for (const [id, expiresAt] of this.seen) if (expiresAt <= current) this.seen.delete(id);
  }
}

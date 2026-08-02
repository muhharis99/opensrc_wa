export class RequestCorrelator<T> {
  private readonly pending = new Map<string, { resolve: (value: T) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();

  public wait(tag: string, timeoutMs: number): Promise<T> {
    if (this.pending.has(tag)) return Promise.reject(new Error(`Duplicate request tag: ${tag}`));
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(tag);
        reject(new Error(`Request timed out: ${tag}`));
      }, timeoutMs);
      this.pending.set(tag, { resolve, reject, timer });
    });
  }

  public resolve(tag: string, value: T): boolean {
    const item = this.pending.get(tag);
    if (!item) return false;
    clearTimeout(item.timer);
    this.pending.delete(tag);
    item.resolve(value);
    return true;
  }

  public rejectAll(error: Error): void {
    for (const item of this.pending.values()) {
      clearTimeout(item.timer);
      item.reject(error);
    }
    this.pending.clear();
  }
}

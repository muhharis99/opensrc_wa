export class AsyncMutex {
  private tail: Promise<void> = Promise.resolve();

  public async run<T>(callback: () => Promise<T>): Promise<T> {
    let release: () => void = () => undefined;
    const wait = this.tail;
    this.tail = new Promise<void>((resolve) => { release = resolve; });
    await wait;
    try { return await callback(); } finally { release(); }
  }
}

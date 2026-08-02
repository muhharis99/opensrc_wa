export interface PacedOutboundQueueOptions {
  sessionIntervalMs: number;
  chatIntervalMs: number;
  maxPending: number;
}

export interface PacedOutboundQueueStats {
  pending: number;
  sessions: number;
  chats: number;
}

export class PacedOutboundQueue {
  private readonly sessionChains = new Map<string, Promise<void>>();
  private readonly nextSessionAt = new Map<string, number>();
  private readonly nextChatAt = new Map<string, number>();
  private pending = 0;

  public constructor(private readonly options: PacedOutboundQueueOptions) {
    if (!Number.isInteger(options.sessionIntervalMs) || options.sessionIntervalMs < 0) throw new Error("sessionIntervalMs tidak valid");
    if (!Number.isInteger(options.chatIntervalMs) || options.chatIntervalMs < 0) throw new Error("chatIntervalMs tidak valid");
    if (!Number.isInteger(options.maxPending) || options.maxPending < 1) throw new Error("maxPending tidak valid");
  }

  public enqueue<T>(sessionId: string, chatId: string, task: () => Promise<T>): Promise<T> {
    if (this.pending >= this.options.maxPending) throw new Error("OUTBOUND_QUEUE_FULL");
    this.pending += 1;
    const previous = this.sessionChains.get(sessionId) ?? Promise.resolve();
    const chatKey = `${sessionId}:${chatId}`;

    const run = previous.catch(() => undefined).then(async () => {
      const now = Date.now();
      const dueAt = Math.max(this.nextSessionAt.get(sessionId) ?? now, this.nextChatAt.get(chatKey) ?? now);
      if (dueAt > now) await delay(dueAt - now);
      const startedAt = Date.now();
      this.nextSessionAt.set(sessionId, startedAt + this.options.sessionIntervalMs);
      this.nextChatAt.set(chatKey, startedAt + this.options.chatIntervalMs);
      return task();
    });

    let chain!: Promise<void>;
    const result = run.finally(() => {
      this.pending -= 1;
      if (this.sessionChains.get(sessionId) === chain) this.sessionChains.delete(sessionId);
      this.prune();
    });
    chain = result.then(() => undefined, () => undefined);
    this.sessionChains.set(sessionId, chain);
    return result;
  }

  public stats(): PacedOutboundQueueStats {
    return { pending: this.pending, sessions: this.sessionChains.size, chats: this.nextChatAt.size };
  }

  private prune(): void {
    const now = Date.now();
    for (const [key, value] of this.nextChatAt) if (value + 60_000 < now) this.nextChatAt.delete(key);
    for (const [key, value] of this.nextSessionAt) if (value + 60_000 < now && !this.sessionChains.has(key)) this.nextSessionAt.delete(key);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

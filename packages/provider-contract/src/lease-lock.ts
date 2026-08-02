export interface SessionLeaseHandle {
  readonly sessionId: string;
  readonly ownerId: string;
  renew(): Promise<void>;
  release(): Promise<void>;
}

export interface SessionLeaseLock {
  acquire(sessionId: string, ttlMs: number): Promise<SessionLeaseHandle>;
}

export class NoopSessionLeaseLock implements SessionLeaseLock {
  public async acquire(sessionId: string): Promise<SessionLeaseHandle> {
    return {
      sessionId,
      ownerId: "noop",
      renew: async () => undefined,
      release: async () => undefined
    };
  }
}

import { calculateBackoff, type RetryPolicy } from "../../core/src/retry";
import type { Transport, TransportState } from "./transport";

export class ReconnectingTransport implements Transport {
  private attempts = 0;
  public constructor(private readonly inner: Transport, private readonly policy: RetryPolicy) {}

  public async connect(): Promise<void> {
    while (true) {
      try {
        await this.inner.connect();
        this.attempts = 0;
        return;
      } catch (error) {
        this.attempts += 1;
        if (this.attempts >= this.policy.maxAttempts) throw error;
        await new Promise<void>((resolve) => setTimeout(resolve, calculateBackoff(this.attempts, this.policy)));
      }
    }
  }

  public disconnect(reason?: string): Promise<void> { return this.inner.disconnect(reason); }
  public send(data: Uint8Array): Promise<void> { return this.inner.send(data); }
  public onFrame(handler: (data: Uint8Array) => Promise<void> | void): () => void { return this.inner.onFrame(handler); }
  public getState(): TransportState { return this.inner.getState(); }
}

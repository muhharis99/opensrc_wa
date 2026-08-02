import type { Transport, TransportState } from "./transport";

export class MockTransport implements Transport {
  private state: TransportState = "idle";
  private readonly handlers = new Set<(data: Uint8Array) => Promise<void> | void>();
  public readonly sentFrames: Uint8Array[] = [];

  public async connect(): Promise<void> {
    this.state = "connecting";
    await Promise.resolve();
    this.state = "connected";
  }

  public async disconnect(): Promise<void> {
    this.state = "closing";
    await Promise.resolve();
    this.state = "closed";
  }

  public async send(data: Uint8Array): Promise<void> {
    if (this.state !== "connected") throw new Error("Transport is not connected");
    this.sentFrames.push(new Uint8Array(data));
  }

  public onFrame(handler: (data: Uint8Array) => Promise<void> | void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  public getState(): TransportState { return this.state; }

  public async inject(data: Uint8Array): Promise<void> {
    for (const handler of this.handlers) await handler(new Uint8Array(data));
  }
}

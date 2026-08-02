import type { Transport, TransportState } from "./transport";

export class NativeWebSocketTransport implements Transport {
  private state: TransportState = "idle";
  private socket: WebSocket | null = null;
  private readonly handlers = new Set<(data: Uint8Array) => Promise<void> | void>();

  public constructor(private readonly url: string, private readonly timeoutMs = 10_000) {}

  public async connect(): Promise<void> {
    if (this.socket) throw new Error("Transport already initialized");
    this.state = "connecting";
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(this.url);
      socket.binaryType = "arraybuffer";
      this.socket = socket;
      const timer = setTimeout(() => reject(new Error("WebSocket connect timeout")), this.timeoutMs);
      socket.onopen = () => { clearTimeout(timer); this.state = "connected"; resolve(); };
      socket.onerror = () => { clearTimeout(timer); this.state = "error"; reject(new Error("WebSocket connection failed")); };
      socket.onclose = () => { this.state = "closed"; };
      socket.onmessage = (event: MessageEvent) => {
        const data = typeof event.data === "string" ? new TextEncoder().encode(event.data) : new Uint8Array(event.data as ArrayBuffer);
        for (const handler of this.handlers) void handler(data);
      };
    });
  }

  public async disconnect(reason = "client disconnect"): Promise<void> {
    this.state = "closing";
    this.socket?.close(1000, reason.slice(0, 120));
    this.socket = null;
    this.state = "closed";
  }

  public async send(data: Uint8Array): Promise<void> {
    if (!this.socket || this.state !== "connected") throw new Error("Transport is not connected");
    this.socket.send(data);
  }

  public onFrame(handler: (data: Uint8Array) => Promise<void> | void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  public getState(): TransportState { return this.state; }
}

export type TransportState = "idle" | "connecting" | "connected" | "closing" | "closed" | "error";

export interface Transport {
  connect(): Promise<void>;
  disconnect(reason?: string): Promise<void>;
  send(data: Uint8Array): Promise<void>;
  onFrame(handler: (data: Uint8Array) => Promise<void> | void): () => void;
  getState(): TransportState;
}

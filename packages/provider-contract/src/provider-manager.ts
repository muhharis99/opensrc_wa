import type {
  ProviderConnectOptions,
  ProviderEvent,
  ProviderEventListener,
  ProviderFactory,
  ProviderSendRequest,
  ProviderSendResult,
  WhatsAppProvider
} from "./types";
import type { PacedOutboundQueue, PacedOutboundQueueStats } from "./paced-outbound-queue";

export interface ProviderManagerOptions {
  outboundQueue?: PacedOutboundQueue;
}

export class ProviderManager {
  private readonly providers = new Map<string, WhatsAppProvider>();
  private readonly listeners = new Set<ProviderEventListener>();
  private readonly unsubscribers = new Map<string, () => void>();

  public constructor(
    private readonly factory: ProviderFactory,
    private readonly options: ProviderManagerOptions = {}
  ) {}

  public get(sessionId: string): WhatsAppProvider {
    const existing = this.providers.get(sessionId);
    if (existing) return existing;
    const provider = this.factory.create(sessionId);
    const unsubscribe = provider.onEvent(async (event) => {
      for (const listener of [...this.listeners]) await listener(event);
    });
    this.providers.set(sessionId, provider);
    this.unsubscribers.set(sessionId, unsubscribe);
    return provider;
  }

  public listSessionIds(): string[] { return [...this.providers.keys()].sort(); }

  public async connect(sessionId: string, options?: ProviderConnectOptions): Promise<void> {
    await this.get(sessionId).connect(options);
  }

  public async requestPairingCode(sessionId: string, phone: string): Promise<string> {
    return this.get(sessionId).requestPairingCode(phone);
  }

  public async send(sessionId: string, request: ProviderSendRequest): Promise<ProviderSendResult> {
    const provider = this.get(sessionId);
    if (!this.options.outboundQueue) return provider.send(request);
    return this.options.outboundQueue.enqueue(sessionId, request.to, () => provider.send(request));
  }

  public queueStats(): PacedOutboundQueueStats | null {
    return this.options.outboundQueue?.stats() ?? null;
  }

  public async disconnect(sessionId: string): Promise<void> {
    const provider = this.providers.get(sessionId);
    if (provider) await provider.disconnect();
  }

  public async logout(sessionId: string): Promise<void> {
    const provider = this.providers.get(sessionId);
    if (provider) await provider.logout();
  }

  public async remove(sessionId: string): Promise<void> {
    await this.disconnect(sessionId);
    this.unsubscribers.get(sessionId)?.();
    this.unsubscribers.delete(sessionId);
    this.providers.delete(sessionId);
  }

  public onEvent(listener: ProviderEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public async closeAll(): Promise<void> {
    await Promise.allSettled([...this.providers.values()].map((provider) => provider.disconnect()));
    for (const unsubscribe of this.unsubscribers.values()) unsubscribe();
    this.unsubscribers.clear();
    this.providers.clear();
  }

  public async emitForTest(event: ProviderEvent): Promise<void> {
    for (const listener of [...this.listeners]) await listener(event);
  }
}

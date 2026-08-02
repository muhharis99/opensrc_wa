export type EventHandler<T> = (event: T) => void | Promise<void>;

export class TypedEventEmitter<TEvents extends object> {
  private readonly listeners = new Map<keyof TEvents, Set<EventHandler<unknown>>>();

  public on<TKey extends keyof TEvents>(eventName: TKey, handler: EventHandler<TEvents[TKey]>): () => void {
    const set = this.listeners.get(eventName) ?? new Set<EventHandler<unknown>>();
    set.add(handler as EventHandler<unknown>);
    this.listeners.set(eventName, set);
    return () => set.delete(handler as EventHandler<unknown>);
  }

  public async emit<TKey extends keyof TEvents>(eventName: TKey, event: TEvents[TKey]): Promise<void> {
    const handlers = [...(this.listeners.get(eventName) ?? [])];
    for (const handler of handlers) await handler(event);
  }

  public removeAllListeners(): void {
    this.listeners.clear();
  }
}

export type PluginHook = "session.created" | "session.ready" | "message.before_send" | "message.after_send" | "message.received" | "webhook.before_delivery";
export interface PluginContext { hook: PluginHook; sessionId: string; payload: unknown; timestamp: string; }
export interface OpenSrcWaPlugin {
  id: string;
  version: string;
  hooks: PluginHook[];
  handle(context: PluginContext): Promise<unknown> | unknown;
}
export interface PluginDescriptor { id: string; version: string; hooks: PluginHook[]; }

export class PluginRegistry {
  private readonly plugins = new Map<string, OpenSrcWaPlugin>();

  public register(plugin: OpenSrcWaPlugin): void {
    if (!/^[a-z0-9][a-z0-9._-]{1,63}$/i.test(plugin.id)) throw new Error("Invalid plugin id");
    if (this.plugins.has(plugin.id)) throw new Error(`Plugin already registered: ${plugin.id}`);
    this.plugins.set(plugin.id, plugin);
  }

  public unregister(pluginId: string): boolean { return this.plugins.delete(pluginId); }
  public list(): PluginDescriptor[] { return [...this.plugins.values()].map((plugin) => ({ id: plugin.id, version: plugin.version, hooks: [...plugin.hooks] })); }

  public async run(hook: PluginHook, sessionId: string, payload: unknown): Promise<unknown[]> {
    const context: PluginContext = { hook, sessionId, payload, timestamp: new Date().toISOString() };
    const results: unknown[] = [];
    for (const plugin of this.plugins.values()) if (plugin.hooks.includes(hook)) results.push(await plugin.handle(context));
    return results;
  }
}

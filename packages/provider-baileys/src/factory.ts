import type { ProviderFactory, WhatsAppProvider } from "../../provider-contract/src/types";
import { BaileysProvider } from "./baileys-provider";
import type { BaileysModuleLoader } from "./module-loader";

export interface BaileysProviderFactoryOptions {
  authRootDir: string;
  reconnectBaseDelayMs?: number;
  reconnectMaxDelayMs?: number;
  moduleLoader?: BaileysModuleLoader;
}

export class BaileysProviderFactory implements ProviderFactory {
  public constructor(private readonly options: BaileysProviderFactoryOptions) {}

  public create(sessionId: string): WhatsAppProvider {
    return new BaileysProvider({ sessionId, ...this.options });
  }
}

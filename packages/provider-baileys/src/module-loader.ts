export type BaileysModule = Record<string, any> & {
  default?: (...args: any[]) => any;
  makeWASocket?: (...args: any[]) => any;
  useMultiFileAuthState: (directory: string) => Promise<{ state: any; saveCreds: () => Promise<void> }>;
};

export type BaileysModuleLoader = () => Promise<BaileysModule>;

export const loadBaileysModule: BaileysModuleLoader = async () => {
  try {
    const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<BaileysModule>;
    return await dynamicImport("@whiskeysockets/baileys");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Baileys provider is selected but @whiskeysockets/baileys is unavailable. ` +
      `Install the exact supported version with: pnpm add -w @whiskeysockets/baileys@7.0.0-rc13. Cause: ${message}`
    );
  }
};

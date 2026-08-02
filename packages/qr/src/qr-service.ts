export interface RenderedQrCode {
  png: Uint8Array;
  base64: string;
  dataUrl: string;
}

type QrCodeModule = {
  toBuffer(text: string, options?: Record<string, unknown>): Promise<Uint8Array>;
  toDataURL(text: string, options?: Record<string, unknown>): Promise<string>;
};

export class QrService {
  private module: QrCodeModule | null = null;

  public async render(payload: string): Promise<RenderedQrCode> {
    if (!payload.trim()) throw new Error("QR payload kosong");
    const qr = await this.load();
    const options = { type: "png", errorCorrectionLevel: "M", margin: 2, width: 320 };
    const [pngValue, dataUrl] = await Promise.all([
      qr.toBuffer(payload, options),
      qr.toDataURL(payload, options)
    ]);
    const png = new Uint8Array(pngValue);
    return { png, base64: Buffer.from(png).toString("base64"), dataUrl };
  }

  private async load(): Promise<QrCodeModule> {
    if (this.module) return this.module;
    const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<Record<string, unknown>>;
    const imported = await dynamicImport("qrcode");
    const candidate = (imported.default ?? imported) as QrCodeModule;
    if (typeof candidate.toBuffer !== "function" || typeof candidate.toDataURL !== "function") {
      throw new Error("Dependency qrcode tidak menyediakan renderer PNG yang dibutuhkan");
    }
    this.module = candidate;
    return candidate;
  }
}

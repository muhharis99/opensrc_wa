import { CryptoProvider } from "../../../packages/crypto/src/crypto-provider";

export class ApiKeyAuthenticator {
  private readonly crypto = new CryptoProvider();
  public constructor(private readonly expectedHash: string) {}

  public verify(apiKey: string | undefined): boolean {
    if (!apiKey) return false;
    return this.crypto.timingSafeEqualHex(this.crypto.sha256(apiKey), this.expectedHash);
  }
}

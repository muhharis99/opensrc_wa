import { CryptoProvider } from "../../crypto/src/crypto-provider";

export interface WebhookSignatureHeaders {
  "X-OpenSrc-WA-Event": string;
  "X-OpenSrc-WA-Delivery": string;
  "X-OpenSrc-WA-Timestamp": string;
  "X-OpenSrc-WA-Signature": string;
}

export class WebhookSigner {
  private readonly crypto = new CryptoProvider();
  public sign(secret: string, event: string, deliveryId: string, timestamp: string, body: string): WebhookSignatureHeaders {
    const canonical = `${timestamp}.${deliveryId}.${event}.${body}`;
    const signature = `sha256=${this.crypto.hmacSha256(secret, canonical)}`;
    return {
      "X-OpenSrc-WA-Event": event,
      "X-OpenSrc-WA-Delivery": deliveryId,
      "X-OpenSrc-WA-Timestamp": timestamp,
      "X-OpenSrc-WA-Signature": signature
    };
  }

  public verify(secret: string, headers: WebhookSignatureHeaders, body: string, toleranceSeconds = 300): boolean {
    const age = Math.abs(Date.now() - Date.parse(headers["X-OpenSrc-WA-Timestamp"])) / 1000;
    if (!Number.isFinite(age) || age > toleranceSeconds) return false;
    const expected = this.sign(secret, headers["X-OpenSrc-WA-Event"], headers["X-OpenSrc-WA-Delivery"], headers["X-OpenSrc-WA-Timestamp"], body);
    const actualHex = headers["X-OpenSrc-WA-Signature"].replace(/^sha256=/, "");
    const expectedHex = expected["X-OpenSrc-WA-Signature"].replace(/^sha256=/, "");
    return this.crypto.timingSafeEqualHex(actualHex, expectedHex);
  }
}

import crypto = require("node:crypto");

export interface EncryptedEnvelope {
  version: 1;
  algorithm: "aes-256-gcm";
  iv: string;
  tag: string;
  ciphertext: string;
}

export class CryptoProvider {
  public randomBytes(length: number): Uint8Array {
    return new Uint8Array(crypto.randomBytes(length));
  }

  public sha256(data: Uint8Array | string): string {
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  public hmacSha256(secret: Uint8Array | string, data: Uint8Array | string): string {
    return crypto.createHmac("sha256", secret).update(data).digest("hex");
  }

  public timingSafeEqualHex(left: string, right: string): boolean {
    if (!/^[a-f0-9]+$/i.test(left) || !/^[a-f0-9]+$/i.test(right) || left.length !== right.length) return false;
    return crypto.timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
  }

  public deriveKey(master: Uint8Array, context: string): Uint8Array {
    return new Uint8Array(crypto.hkdfSync("sha256", master, Buffer.alloc(0), Buffer.from(context), 32));
  }

  public encryptJson(value: unknown, key: Uint8Array): EncryptedEnvelope {
    if (key.byteLength !== 32) throw new Error("AES-256-GCM requires a 32-byte key");
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const plaintext = Buffer.from(JSON.stringify(value), "utf8");
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return {
      version: 1,
      algorithm: "aes-256-gcm",
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      ciphertext: ciphertext.toString("base64")
    };
  }

  public decryptJson<T>(envelope: EncryptedEnvelope, key: Uint8Array): T {
    if (envelope.version !== 1 || envelope.algorithm !== "aes-256-gcm") throw new Error("Unsupported encrypted envelope");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64")),
      decipher.final()
    ]);
    return JSON.parse(plaintext.toString("utf8")) as T;
  }
}

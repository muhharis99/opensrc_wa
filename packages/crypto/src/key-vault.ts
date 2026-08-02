import { CryptoProvider, type EncryptedEnvelope } from "./crypto-provider";

export interface VersionedKeyRecord {
  version: 1;
  createdAt: string;
  keyId: string;
  envelope: EncryptedEnvelope;
}

export class KeyVault {
  private readonly crypto = new CryptoProvider();
  public constructor(private readonly masterKey: Uint8Array) {
    if (masterKey.byteLength !== 32) throw new Error("Master key must be 32 bytes");
  }

  public seal(keyId: string, value: Uint8Array): VersionedKeyRecord {
    const scoped = this.crypto.deriveKey(this.masterKey, `opensrc_wa:key:${keyId}`);
    return {
      version: 1,
      createdAt: new Date().toISOString(),
      keyId,
      envelope: this.crypto.encryptJson({ value: Buffer.from(value).toString("base64") }, scoped)
    };
  }

  public open(record: VersionedKeyRecord): Uint8Array {
    const scoped = this.crypto.deriveKey(this.masterKey, `opensrc_wa:key:${record.keyId}`);
    const decoded = this.crypto.decryptJson<{ value: string }>(record.envelope, scoped);
    return new Uint8Array(Buffer.from(decoded.value, "base64"));
  }
}

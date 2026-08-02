import crypto = require("node:crypto");
import { OpenSrcWaError } from "../../core/src/errors";
import { CryptoProvider, type EncryptedEnvelope } from "../../crypto/src/crypto-provider";

export type MediaKind = "image" | "video" | "audio" | "document" | "sticker";
export interface MediaRecord {
  mediaId: string;
  sessionId: string;
  kind: MediaKind;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  caption: string | null;
  voiceNote: boolean;
  viewOnce: boolean;
  createdAt: string;
  protocolStatus: "TESTED_WITH_MOCK";
}

interface StoredMedia { record: MediaRecord; envelope: EncryptedEnvelope; }

export class MediaService {
  private readonly crypto = new CryptoProvider();
  private readonly encryptionKey = this.crypto.randomBytes(32);
  private readonly records = new Map<string, StoredMedia>();

  public constructor(private readonly maxBytes = 10 * 1024 * 1024) {}

  public upload(input: { sessionId: string; kind: MediaKind; fileName: string; mimeType: string; contentBase64: string; caption?: string; voiceNote?: boolean; viewOnce?: boolean }): MediaRecord {
    validateMime(input.kind, input.mimeType);
    let bytes: Uint8Array;
    try { bytes = new Uint8Array(Buffer.from(input.contentBase64, "base64")); }
    catch { throw new OpenSrcWaError({ code: "INVALID_MEDIA", category: "MEDIA_ERROR", message: "Media Base64 tidak valid" }); }
    if (bytes.byteLength === 0 || bytes.byteLength > this.maxBytes) throw new OpenSrcWaError({ code: "MEDIA_SIZE_INVALID", category: "MEDIA_ERROR", message: `Ukuran media harus 1-${this.maxBytes} byte` });
    const mediaId = crypto.randomUUID();
    const record: MediaRecord = {
      mediaId,
      sessionId: input.sessionId,
      kind: input.kind,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: bytes.byteLength,
      sha256: this.crypto.sha256(bytes),
      caption: input.caption ?? null,
      voiceNote: input.voiceNote ?? false,
      viewOnce: input.viewOnce ?? false,
      createdAt: new Date().toISOString(),
      protocolStatus: "TESTED_WITH_MOCK"
    };
    const envelope = this.crypto.encryptJson({ contentBase64: Buffer.from(bytes).toString("base64") }, this.encryptionKey);
    this.records.set(mediaId, { record, envelope });
    return { ...record };
  }

  public get(sessionId: string, mediaId: string): MediaRecord {
    return { ...this.mutable(sessionId, mediaId).record };
  }

  public list(sessionId: string): MediaRecord[] {
    return [...this.records.values()].filter((stored) => stored.record.sessionId === sessionId).map((stored) => ({ ...stored.record }));
  }

  public download(sessionId: string, mediaId: string): { record: MediaRecord; contentBase64: string } {
    const stored = this.mutable(sessionId, mediaId);
    const payload = this.crypto.decryptJson<{ contentBase64: string }>(stored.envelope, this.encryptionKey);
    return { record: { ...stored.record }, contentBase64: payload.contentBase64 };
  }

  public delete(sessionId: string, mediaId: string): void {
    this.mutable(sessionId, mediaId);
    this.records.delete(mediaId);
  }

  private mutable(sessionId: string, mediaId: string): StoredMedia {
    const stored = this.records.get(mediaId);
    if (!stored || stored.record.sessionId !== sessionId) throw new OpenSrcWaError({ code: "MEDIA_NOT_FOUND", category: "MEDIA_ERROR", message: "Media tidak ditemukan" });
    return stored;
  }
}

function validateMime(kind: MediaKind, mimeType: string): void {
  const valid = kind === "image" ? mimeType.startsWith("image/")
    : kind === "video" ? mimeType.startsWith("video/")
      : kind === "audio" ? mimeType.startsWith("audio/")
        : kind === "sticker" ? mimeType === "image/webp"
          : mimeType.length > 0;
  if (!valid) throw new OpenSrcWaError({ code: "MEDIA_MIME_INVALID", category: "MEDIA_ERROR", message: `MIME ${mimeType} tidak sesuai untuk ${kind}` });
}

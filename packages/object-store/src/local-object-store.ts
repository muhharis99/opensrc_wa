import crypto = require("node:crypto");
import fs = require("node:fs");
import fsp = require("node:fs/promises");
import path = require("node:path");
import type { ObjectMetadata, ObjectStore, StoredObject } from "./types";

export class LocalObjectStore implements ObjectStore {
  public constructor(private readonly rootDir: string) {}

  public async put(input: {
    objectId: string;
    contentType: string;
    fileName?: string;
    stream: AsyncIterable<Uint8Array>;
  }): Promise<ObjectMetadata> {
    const objectId = safeObjectId(input.objectId);
    await fsp.mkdir(this.rootDir, { recursive: true, mode: 0o700 });
    const finalPath = this.dataPath(objectId);
    const temporaryPath = `${finalPath}.${crypto.randomUUID()}.tmp`;
    const output = fs.createWriteStream(temporaryPath, { flags: "wx", mode: 0o600 });
    const hash = crypto.createHash("sha256");
    let size = 0;

    try {
      for await (const chunk of input.stream) {
        const bytes = Buffer.from(chunk);
        size += bytes.byteLength;
        hash.update(bytes);
        if (!output.write(bytes)) await waitFor(output, "drain");
      }
      output.end();
      await waitFor(output, "finish");
      await fsp.rename(temporaryPath, finalPath);
    } catch (error) {
      output.destroy();
      await fsp.rm(temporaryPath, { force: true }).catch(() => undefined);
      throw error;
    }

    const metadata: ObjectMetadata = {
      objectId,
      contentType: input.contentType || "application/octet-stream",
      size,
      createdAt: new Date().toISOString(),
      fileName: input.fileName?.trim() || null,
      sha256: hash.digest("hex")
    };
    const metadataPath = this.metadataPath(objectId);
    const temporaryMetadataPath = `${metadataPath}.${crypto.randomUUID()}.tmp`;
    await fsp.writeFile(temporaryMetadataPath, JSON.stringify(metadata), { encoding: "utf8", mode: 0o600 });
    await fsp.rename(temporaryMetadataPath, metadataPath);
    return metadata;
  }

  public async get(objectIdInput: string): Promise<StoredObject> {
    const objectId = safeObjectId(objectIdInput);
    const metadata = JSON.parse(await fsp.readFile(this.metadataPath(objectId), "utf8")) as ObjectMetadata;
    const stream = fs.createReadStream(this.dataPath(objectId));
    return { metadata, stream: stream as AsyncIterable<Uint8Array> };
  }

  public async delete(objectIdInput: string): Promise<boolean> {
    const objectId = safeObjectId(objectIdInput);
    const results = await Promise.all([
      fsp.rm(this.dataPath(objectId), { force: true }).then(() => true).catch(() => false),
      fsp.rm(this.metadataPath(objectId), { force: true }).then(() => true).catch(() => false)
    ]);
    return results.some(Boolean);
  }

  private dataPath(objectId: string): string { return path.resolve(this.rootDir, `${objectId}.bin`); }
  private metadataPath(objectId: string): string { return path.resolve(this.rootDir, `${objectId}.json`); }
}

function safeObjectId(value: string): string {
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(value)) throw new Error("object_id tidak valid");
  return value;
}

function waitFor(stream: any, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => { cleanup(); reject(error); };
    const onEvent = () => { cleanup(); resolve(); };
    const cleanup = () => {
      stream.off?.("error", onError);
      stream.off?.(event, onEvent);
    };
    stream.once("error", onError);
    stream.once(event, onEvent);
  });
}

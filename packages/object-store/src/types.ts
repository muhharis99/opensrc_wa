export interface ObjectMetadata {
  objectId: string;
  contentType: string;
  size: number;
  createdAt: string;
  fileName: string | null;
  sha256: string;
}

export interface StoredObject {
  metadata: ObjectMetadata;
  stream: AsyncIterable<Uint8Array>;
}

export interface ObjectStore {
  put(input: {
    objectId: string;
    contentType: string;
    fileName?: string;
    stream: AsyncIterable<Uint8Array>;
  }): Promise<ObjectMetadata>;
  get(objectId: string): Promise<StoredObject>;
  delete(objectId: string): Promise<boolean>;
}

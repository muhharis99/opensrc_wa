import test = require("node:test");
import assert = require("node:assert/strict");
import { MediaService } from "../packages/media/src/media-service";

test("media service encrypts, indexes, and returns mock media", () => {
  const media = new MediaService(1024);
  const source = Buffer.from("image-fixture").toString("base64");
  const record = media.upload({ sessionId: "s1", kind: "image", fileName: "test.png", mimeType: "image/png", contentBase64: source, caption: "fixture" });
  assert.equal(record.protocolStatus, "TESTED_WITH_MOCK");
  assert.equal(media.download("s1", record.mediaId).contentBase64, source);
  assert.equal(media.list("s1").length, 1);
  media.delete("s1", record.mediaId);
  assert.equal(media.list("s1").length, 0);
});

test("media service validates MIME and size", () => {
  const media = new MediaService(4);
  assert.throws(() => media.upload({ sessionId: "s1", kind: "image", fileName: "bad.txt", mimeType: "text/plain", contentBase64: Buffer.from("x").toString("base64") }), /MIME/);
  assert.throws(() => media.upload({ sessionId: "s1", kind: "document", fileName: "large.bin", mimeType: "application/octet-stream", contentBase64: Buffer.from("12345").toString("base64") }), /Ukuran/);
});

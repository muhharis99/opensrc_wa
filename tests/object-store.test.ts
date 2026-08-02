import test = require("node:test");
import assert = require("node:assert/strict");
import fsp = require("node:fs/promises");
import os = require("node:os");
import path = require("node:path");
import { LocalObjectStore } from "../packages/object-store/src/local-object-store";

test("local object store writes and streams content with integrity metadata", async () => {
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), "opensrc-wa-object-"));
  const store = new LocalObjectStore(directory);
  const metadata = await store.put({
    objectId: "media_test_0001",
    contentType: "text/plain",
    fileName: "hello.txt",
    stream: chunks([Buffer.from("hello "), Buffer.from("world")])
  });
  assert.equal(metadata.size, 11);
  assert.equal(metadata.fileName, "hello.txt");
  const stored = await store.get(metadata.objectId);
  const output: Uint8Array[] = [];
  for await (const chunk of stored.stream) output.push(chunk);
  assert.equal(Buffer.concat(output).toString("utf8"), "hello world");
  assert.equal(await store.delete(metadata.objectId), true);
  await fsp.rm(directory, { recursive: true, force: true });
});

async function* chunks(values: Uint8Array[]): AsyncIterable<Uint8Array> {
  for (const value of values) yield value;
}

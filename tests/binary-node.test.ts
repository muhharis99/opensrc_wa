import test = require("node:test");
import assert = require("node:assert/strict");
import { BinaryNodeCodec } from "../packages/protocol/src/binary-node";

test("binary node codec round trips", () => {
  const codec = new BinaryNodeCodec();
  const node = { tag: "message", attributes: { id: "fixture-1" }, content: new Uint8Array([10, 20]) };
  assert.deepEqual(codec.decode(codec.encode(node)), node);
});

test("binary node codec rejects malformed payload", () => {
  const codec = new BinaryNodeCodec();
  assert.throws(() => codec.decode(new TextEncoder().encode("not-json")), /invalid/i);
});

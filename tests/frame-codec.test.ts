import test = require("node:test");
import assert = require("node:assert/strict");
import { LengthPrefixedFrameCodec } from "../packages/protocol/src/frame-codec";

test("frame codec round trips deterministic payload", () => {
  const codec = new LengthPrefixedFrameCodec(128);
  const payload = new Uint8Array([1, 2, 3, 4]);
  assert.deepEqual(codec.decode(codec.encode(payload)), payload);
});

test("frame codec rejects malformed input", () => {
  const codec = new LengthPrefixedFrameCodec(128);
  assert.throws(() => codec.decode(new Uint8Array([0, 0, 0, 5, 1])), /length mismatch/i);
});

test("frame codec enforces maximum size", () => {
  const codec = new LengthPrefixedFrameCodec(2);
  assert.throws(() => codec.encode(new Uint8Array([1, 2, 3])), /exceeds configured limit/i);
});

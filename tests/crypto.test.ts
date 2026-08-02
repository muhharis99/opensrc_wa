import test = require("node:test");
import assert = require("node:assert/strict");
import { CryptoProvider } from "../packages/crypto/src/crypto-provider";

test("AES-GCM envelope round trips", () => {
  const provider = new CryptoProvider();
  const key = new Uint8Array(32).fill(7);
  const encrypted = provider.encryptJson({ session: "test", secret: "hidden" }, key);
  assert.equal(encrypted.algorithm, "aes-256-gcm");
  assert.deepEqual(provider.decryptJson(encrypted, key), { session: "test", secret: "hidden" });
});

test("timing safe comparison rejects invalid hex", () => {
  const provider = new CryptoProvider();
  assert.equal(provider.timingSafeEqualHex("aa", "aa"), true);
  assert.equal(provider.timingSafeEqualHex("aa", "ab"), false);
  assert.equal(provider.timingSafeEqualHex("not-hex", "not-hex"), false);
});

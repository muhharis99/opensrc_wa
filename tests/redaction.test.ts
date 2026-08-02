import test = require("node:test");
import assert = require("node:assert/strict");
import { maskPhone, redact } from "../packages/observability/src/redaction";

test("phone numbers are masked", () => {
  assert.equal(maskPhone("6281234567890"), "6281******890");
});

test("sensitive fields are redacted recursively", () => {
  assert.deepEqual(redact({ apiKey: "secret", nested: { text: "hello", phone: "6281234567890" } }), {
    apiKey: "[REDACTED]",
    nested: { text: "[REDACTED]", phone: "6281******890" }
  });
});

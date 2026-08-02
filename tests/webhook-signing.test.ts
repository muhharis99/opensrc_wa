import test = require("node:test");
import assert = require("node:assert/strict");
import { WebhookSigner } from "../packages/webhook/src/signing";

test("webhook signature verifies and detects tampering", () => {
  const signer = new WebhookSigner();
  const timestamp = new Date().toISOString();
  const headers = signer.sign("0123456789abcdef", "message.sent", "delivery-1", timestamp, "{\"ok\":true}");
  assert.equal(signer.verify("0123456789abcdef", headers, "{\"ok\":true}"), true);
  assert.equal(signer.verify("0123456789abcdef", headers, "{\"ok\":false}"), false);
});

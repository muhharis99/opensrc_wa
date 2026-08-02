import test = require("node:test");
import assert = require("node:assert/strict");
import { FixedWindowRateLimiter } from "../apps/gateway/src/rate-limiter";

test("rate limiter blocks requests over configured limit", () => {
  const limiter = new FixedWindowRateLimiter(2, 1000, () => 1);
  assert.equal(limiter.consume("client").allowed, true);
  assert.equal(limiter.consume("client").allowed, true);
  assert.equal(limiter.consume("client").allowed, false);
});

import test = require("node:test");
import assert = require("node:assert/strict");
import { PacedOutboundQueue } from "../packages/provider-contract/src/paced-outbound-queue";

test("outbound queue serializes a session and applies chat pacing", async () => {
  const queue = new PacedOutboundQueue({ sessionIntervalMs: 10, chatIntervalMs: 20, maxPending: 10 });
  const starts: number[] = [];
  const first = queue.enqueue("s1", "chat-a", async () => { starts.push(Date.now()); return "a"; });
  const second = queue.enqueue("s1", "chat-a", async () => { starts.push(Date.now()); return "b"; });
  assert.deepEqual(await Promise.all([first, second]), ["a", "b"]);
  assert.ok((starts[1] ?? 0) - (starts[0] ?? 0) >= 15);
  assert.equal(queue.stats().pending, 0);
});

test("outbound queue rejects work above capacity", async () => {
  const queue = new PacedOutboundQueue({ sessionIntervalMs: 0, chatIntervalMs: 0, maxPending: 1 });
  let release: (() => void) | undefined;
  const blocked = queue.enqueue("s1", "chat-a", () => new Promise<string>((resolve) => { release = () => resolve("ok"); }));
  assert.throws(() => queue.enqueue("s2", "chat-b", async () => "overflow"), /OUTBOUND_QUEUE_FULL/);
  release?.();
  assert.equal(await blocked, "ok");
});

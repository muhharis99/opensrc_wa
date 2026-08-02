import test = require("node:test");
import assert = require("node:assert/strict");
import { BusinessService, CallService, HistoryService, LabelService, PrivacyService } from "../packages/domain/src";

test("business catalog, labels, calls, privacy, and history are available in mock runtime", () => {
  const business = new BusinessService();
  business.setProfile({ sessionId: "s1", name: "Example Store", categories: ["retail"] });
  const product = business.createProduct({ sessionId: "s1", name: "Product", priceMinor: 150000, currency: "idr" });
  assert.equal(business.updateProduct("s1", product.productId, { hidden: true }).hidden, true);
  assert.equal(business.listProducts("s1", true).length, 1);

  const labels = new LabelService();
  const label = labels.create("s1", "Priority", 1);
  assert.equal(labels.assign("s1", label.labelId, "chat", "chat-1", true).length, 1);

  const calls = new CallService();
  const call = calls.inject({ sessionId: "s1", peerJid: "6281@s.whatsapp.net", kind: "video" });
  assert.equal(calls.update("s1", call.callId, "rejected").state, "rejected");

  const privacy = new PrivacyService();
  assert.equal(privacy.update("s1", { silenceUnknownCalls: true }).silenceUnknownCalls, true);

  const history = new HistoryService();
  const snapshot = history.create("s1", { products: business.listProducts("s1", true), labels: labels.list("s1") });
  assert.equal(snapshot.counts.products, 1);
  assert.equal(history.get("s1", snapshot.snapshotId).protocolStatus, "TESTED_WITH_MOCK");
});

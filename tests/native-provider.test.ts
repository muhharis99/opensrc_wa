import test = require("node:test");
import assert = require("node:assert/strict");
import { NativeProvider } from "../packages/provider-native/src/native-provider";

test("native provider refuses live connection without reproducible evidence", async () => {
  const provider = new NativeProvider("native-test");
  const events: string[] = [];
  provider.onEvent((event) => events.push(event.type === "connection.update" ? event.state : event.type));
  await assert.rejects(() => provider.connect(), /NATIVE_PROTOCOL_BLOCKED/);
  assert.deepEqual(events, ["connecting", "error"]);
  assert.equal(provider.status().status, "BLOCKED");
});

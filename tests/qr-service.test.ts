import test = require("node:test");
import assert = require("node:assert/strict");
import { QrService } from "../packages/qr/src/qr-service";

test("QR service renders PNG, base64, and data URL", async () => {
  const rendered = await new QrService().render("opensrc_wa:test:pairing");
  assert.deepEqual([...rendered.png.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(rendered.base64.length > 100);
  assert.ok(rendered.dataUrl.startsWith("data:image/png;base64,"));
});

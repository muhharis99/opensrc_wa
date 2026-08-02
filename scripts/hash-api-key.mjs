import crypto from "node:crypto";
const key = process.argv[2];
if (!key) {
  process.stderr.write("Usage: node scripts/hash-api-key.mjs <api-key>\n");
  process.exit(1);
}
process.stdout.write(`${crypto.createHash("sha256").update(key).digest("hex")}\n`);

import { access, readFile } from "node:fs/promises";

const required = [
  "README.md", "AUDIT.md", "SECURITY.md", "CONTRIBUTING.md", "CODE_OF_CONDUCT.md", "CHANGELOG.md",
  "docs/ARCHITECTURE.md", "docs/PROTOCOL_RESEARCH.md", "docs/PROTOCOL_STATUS.md",
  "docs/SECURITY_MODEL.md", "docs/THREAT_MODEL.md", "docs/SESSION_LIFECYCLE.md",
  "docs/MESSAGE_LIFECYCLE.md", "docs/WEBHOOKS.md", "docs/API.md", "docs/TESTING.md",
  "docs/TROUBLESHOOTING.md", "docs/RESPONSIBLE_USE.md", "docs/DEPENDENCY_POLICY.md",
  "docs/REFERENCES.md", "docs/ROADMAP.md", "docs/LIVE_PROVIDER_STATUS.md",
  "docs/adr/0001-multi-provider-baileys.md"
];

for (const file of required) await access(file);

const readme = (await readFile("README.md", "utf8")).toLowerCase();
const requiredPhrases = [
  "tidak berafiliasi",
  "unofficial software",
  "jangan gunakan proyek ini untuk spam",
  "live e2e dinonaktifkan",
  "whatsappprovider",
  "baileysprovider"
];

const missing = requiredPhrases.filter((phrase) => !readme.includes(phrase));
if (missing.length > 0) {
  throw new Error(`README is missing required disclaimer/status phrases: ${missing.join(", ")}`);
}

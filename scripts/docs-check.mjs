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
const hasDisclaimer = readme.includes("tidak berafiliasi") && readme.includes("unofficial");
const hasHonestStatus = readme.includes("belum") && readme.includes("live e2e") && readme.includes("risiko");
const hasResponsibleUse = readme.includes("spam") && readme.includes("persetujuan");
const hasProviderBoundary = readme.includes("whatsappprovider") && readme.includes("baileysprovider");

if (!hasDisclaimer || !hasHonestStatus || !hasResponsibleUse || !hasProviderBoundary) {
  throw new Error("README must contain affiliation disclaimer, honest live-test status, responsible-use warning, and provider boundary");
}

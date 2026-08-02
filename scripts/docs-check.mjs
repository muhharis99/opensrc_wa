import { access, readFile } from "node:fs/promises";
const required = [
  "README.md", "SECURITY.md", "CONTRIBUTING.md", "CODE_OF_CONDUCT.md", "CHANGELOG.md",
  "docs/ARCHITECTURE.md", "docs/PROTOCOL_RESEARCH.md", "docs/PROTOCOL_STATUS.md",
  "docs/SECURITY_MODEL.md", "docs/THREAT_MODEL.md", "docs/SESSION_LIFECYCLE.md",
  "docs/MESSAGE_LIFECYCLE.md", "docs/WEBHOOKS.md", "docs/API.md", "docs/TESTING.md",
  "docs/TROUBLESHOOTING.md", "docs/RESPONSIBLE_USE.md", "docs/DEPENDENCY_POLICY.md",
  "docs/REFERENCES.md", "docs/ROADMAP.md"
];
for (const file of required) await access(file);
const readme = await readFile("README.md", "utf8");
if (!readme.includes("tidak berafiliasi") || !readme.includes("BLOCKED")) {
  throw new Error("README must contain affiliation disclaimer and honest protocol status");
}

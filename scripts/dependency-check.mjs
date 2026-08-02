import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
const forbidden = ["baileys", "venom", "whatsapp-web.js", "wppconnect", "open-wa", "puppeteer", "playwright", "selenium"];
const allowedDocs = new Set(["docs/REFERENCES.md", "docs/DEPENDENCY_POLICY.md", "README.md", "scripts/dependency-check.mjs"]);
async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if ([".git", "dist", "node_modules"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full.replaceAll("\\", "/"));
  }
  return files;
}
let failures = 0;
for (const file of await walk(".")) {
  if (allowedDocs.has(file)) continue;
  const text = (await readFile(file, "utf8")).toLowerCase();
  for (const token of forbidden) {
    if (text.includes(token)) {
      process.stderr.write(`${file}: forbidden dependency/reference '${token}'\n`);
      failures += 1;
    }
  }
}
process.exit(failures === 0 ? 0 : 1);

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const forbidden = ["venom", "whatsapp-web.js", "wppconnect", "open-wa", "puppeteer", "playwright", "selenium"];
const baileysToken = "@whiskeysockets/baileys";
const baileysAllowedPrefixes = [
  "packages/provider-baileys/",
  "tests/provider-baileys",
  "docs/",
  "README.md",
  "AUDIT.md",
  "package.json",
  "pnpm-lock.yaml",
  "scripts/dependency-check.mjs"
];

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if ([".git", "dist", "node_modules", "runtime"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full.replaceAll("\\", "/"));
  }
  return files;
}

function isBaileysAllowed(file) {
  return baileysAllowedPrefixes.some((prefix) => file === prefix || file.startsWith(prefix));
}

let failures = 0;
for (const file of await walk(".")) {
  let text;
  try {
    text = (await readFile(file, "utf8")).toLowerCase();
  } catch {
    continue;
  }

  for (const token of forbidden) {
    if (text.includes(token)) {
      process.stderr.write(`${file}: forbidden dependency/reference '${token}'\n`);
      failures += 1;
    }
  }

  if (text.includes(baileysToken) && !isBaileysAllowed(file)) {
    process.stderr.write(`${file}: Baileys may only be referenced inside the isolated provider adapter, tests, manifests, and documentation\n`);
    failures += 1;
  }
}

process.exit(failures === 0 ? 0 : 1);

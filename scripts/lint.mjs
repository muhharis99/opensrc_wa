import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const roots = ["apps", "packages", "tests", "scripts"];
const forbidden = [
  { pattern: /\beval\s*\(/, message: "eval is forbidden" },
  { pattern: /console\.log\s*\(/, message: "use the structured logger instead of console.log" },
  { pattern: /TODO\s*:\s*fake/i, message: "fake implementation marker is forbidden" }
];
let failures = 0;

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (/\.(ts|mjs)$/.test(entry.name)) files.push(full);
  }
  return files;
}

for (const root of roots) {
  for (const file of await walk(root)) {
    const text = await readFile(file, "utf8");
    for (const rule of forbidden) {
      if (rule.pattern.test(text)) {
        process.stderr.write(`${file}: ${rule.message}\n`);
        failures += 1;
      }
    }
    if (text.includes("\t")) {
      process.stderr.write(`${file}: tabs are forbidden\n`);
      failures += 1;
    }
  }
}
process.exit(failures === 0 ? 0 : 1);

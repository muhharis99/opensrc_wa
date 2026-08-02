import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
const roots = ["apps", "packages", "tests", "scripts", "docs"];
let failures = 0;
async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}
for (const root of roots) {
  for (const file of await walk(root)) {
    const text = await readFile(file, "utf8");
    if (!text.endsWith("\n")) {
      process.stderr.write(`${file}: missing final newline\n`);
      failures += 1;
    }
    if (/ +$/m.test(text)) {
      process.stderr.write(`${file}: trailing whitespace\n`);
      failures += 1;
    }
  }
}
process.exit(failures === 0 ? 0 : 1);

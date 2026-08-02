import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";

const mode = process.argv[2] ?? "all";
const build = spawnSync("node", ["scripts/build.mjs"], { stdio: "inherit" });
if ((build.status ?? 1) !== 0) process.exit(build.status ?? 1);

async function collect(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await collect(full));
    else if (entry.name.endsWith(".test.js")) out.push(full);
  }
  return out;
}

let files = await collect("dist/tests");
if (mode === "unit") files = files.filter((file) => !file.includes(`${path.sep}integration${path.sep}`));
if (mode === "integration") files = files.filter((file) => file.includes(`${path.sep}integration${path.sep}`));
const result = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
process.exit(result.status ?? 1);

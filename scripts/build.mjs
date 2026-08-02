import { spawnSync } from "node:child_process";
import { rm } from "node:fs/promises";
await rm("dist", { recursive: true, force: true });
const result = spawnSync("tsc", ["-p", "tsconfig.json"], { stdio: "inherit", shell: process.platform === "win32" });
process.exit(result.status ?? 1);

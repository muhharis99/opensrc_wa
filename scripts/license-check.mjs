import { readFile } from "node:fs/promises";
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
if (packageJson.license !== "Apache-2.0") throw new Error("Root license must be Apache-2.0");
const license = await readFile("LICENSE", "utf8");
if (!license.includes("Apache License") || !license.includes("Version 2.0")) throw new Error("LICENSE file is incomplete");

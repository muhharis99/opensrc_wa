import test = require("node:test");
import assert = require("node:assert/strict");
import { RedisSessionLeaseLock, type RedisCommandClient } from "../packages/provider-baileys/src/redis-lease-lock";

test("Redis lease uses atomic acquire, renew, and owner-safe release", async () => {
  const state = new Map<string, string>();
  const commands: string[][] = [];
  const factory = (): RedisCommandClient => ({
    command: async (args) => {
      commands.push(args);
      if (args[0] === "SET") {
        const key = args[1] as string;
        if (state.has(key)) return null;
        state.set(key, args[2] as string);
        return "OK";
      }
      if (args[0] === "EVAL") {
        const key = args[3] as string;
        const owner = args[4] as string;
        if (state.get(key) !== owner) return 0;
        if (args[1]?.includes("pexpire")) return 1;
        state.delete(key);
        return 1;
      }
      throw new Error(`unexpected command: ${args.join(" ")}`);
    },
    close: async () => undefined
  });

  const lock = new RedisSessionLeaseLock({ url: "redis://localhost:6379/0", commandClientFactory: factory });
  const first = await lock.acquire("utama", 10_000);
  await assert.rejects(() => lock.acquire("utama", 10_000), /SESSION_LOCKED/);
  await first.renew();
  await first.release();
  const second = await lock.acquire("utama", 10_000);
  assert.notEqual(first.ownerId, second.ownerId);
  await second.release();
  assert.ok(commands.some((command) => command[0] === "SET" && command.includes("NX") && command.includes("PX")));
  assert.ok(commands.some((command) => command[0] === "EVAL" && command[1]?.includes("pexpire")));
  assert.ok(commands.some((command) => command[0] === "EVAL" && command[1]?.includes("del")));
});

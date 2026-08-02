import test = require("node:test");
import assert = require("node:assert/strict");
import { SessionStateMachine } from "../packages/core/src/state-machine";

test("session state machine accepts valid lifecycle", () => {
  const machine = new SessionStateMachine();
  assert.equal(machine.transition("CONNECTING"), "CONNECTING");
  assert.equal(machine.transition("AWAITING_PAIRING"), "AWAITING_PAIRING");
  assert.equal(machine.transition("PAIRING"), "PAIRING");
  assert.equal(machine.transition("AUTHENTICATED"), "AUTHENTICATED");
  assert.equal(machine.transition("SYNCING"), "SYNCING");
  assert.equal(machine.transition("READY"), "READY");
});

test("session state machine rejects invalid transition", () => {
  const machine = new SessionStateMachine();
  assert.throws(() => machine.transition("READY"), /tidak diizinkan/);
});

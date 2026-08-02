import { OpenSrcWaError } from "./errors";
import type { SessionState } from "./types";

const allowed: Record<SessionState, readonly SessionState[]> = {
  DISCONNECTED: ["CONNECTING", "LOGGED_OUT"],
  CONNECTING: ["AWAITING_PAIRING", "AUTHENTICATED", "RECONNECTING", "ERROR", "DISCONNECTED"],
  AWAITING_PAIRING: ["PAIRING", "DISCONNECTED", "ERROR", "LOGGED_OUT"],
  PAIRING: ["AUTHENTICATED", "AWAITING_PAIRING", "ERROR", "LOGGED_OUT"],
  AUTHENTICATED: ["SYNCING", "READY", "RECONNECTING", "ERROR", "LOGGED_OUT"],
  SYNCING: ["READY", "RECONNECTING", "ERROR", "LOGGED_OUT"],
  READY: ["RECONNECTING", "DISCONNECTED", "ERROR", "LOGGED_OUT"],
  RECONNECTING: ["CONNECTING", "READY", "DISCONNECTED", "ERROR", "LOGGED_OUT"],
  LOGGED_OUT: ["DISCONNECTED"],
  ERROR: ["DISCONNECTED", "RECONNECTING", "LOGGED_OUT"]
};

export class SessionStateMachine {
  private state: SessionState;
  public constructor(initial: SessionState = "DISCONNECTED") {
    this.state = initial;
  }

  public getState(): SessionState {
    return this.state;
  }

  public canTransition(next: SessionState): boolean {
    return allowed[this.state].includes(next);
  }

  public transition(next: SessionState): SessionState {
    if (!this.canTransition(next)) {
      throw new OpenSrcWaError({
        code: "INVALID_SESSION_TRANSITION",
        category: "SESSION_ERROR",
        message: `Transition ${this.state} -> ${next} tidak diizinkan`,
        details: { current: this.state, next }
      });
    }
    this.state = next;
    return this.state;
  }
}

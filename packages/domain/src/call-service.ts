import crypto = require("node:crypto");
import { OpenSrcWaError } from "../../core/src/errors";

export type CallState = "ringing" | "accepted" | "rejected" | "ended" | "missed";
export interface CallRecord { callId: string; sessionId: string; peerJid: string; direction: "incoming" | "outgoing"; kind: "audio" | "video"; state: CallState; startedAt: string; endedAt: string | null; protocolStatus: "TESTED_WITH_MOCK"; }
export class CallService {
  private readonly calls = new Map<string, CallRecord>();
  public inject(input: { sessionId: string; peerJid: string; direction?: "incoming" | "outgoing"; kind?: "audio" | "video" }): CallRecord {
    const call: CallRecord = { callId: crypto.randomUUID(), sessionId: input.sessionId, peerJid: input.peerJid, direction: input.direction ?? "incoming", kind: input.kind ?? "audio", state: "ringing", startedAt: new Date().toISOString(), endedAt: null, protocolStatus: "TESTED_WITH_MOCK" };
    this.calls.set(call.callId, call);
    return { ...call };
  }
  public list(sessionId: string): CallRecord[] { return [...this.calls.values()].filter((call) => call.sessionId === sessionId).map((call) => ({ ...call })); }
  public update(sessionId: string, callId: string, state: Exclude<CallState, "ringing">): CallRecord {
    const call = this.calls.get(callId);
    if (!call || call.sessionId !== sessionId) throw new OpenSrcWaError({ code: "CALL_NOT_FOUND", category: "VALIDATION_ERROR", message: "Panggilan tidak ditemukan" });
    call.state = state;
    if (["rejected", "ended", "missed"].includes(state)) call.endedAt = new Date().toISOString();
    return { ...call };
  }
}

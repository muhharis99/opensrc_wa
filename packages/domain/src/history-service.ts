import crypto = require("node:crypto");
import { OpenSrcWaError } from "../../core/src/errors";

export interface HistorySnapshot {
  snapshotId: string;
  sessionId: string;
  createdAt: string;
  source: "mock-runtime" | "imported-fixture";
  payload: Record<string, unknown[]>;
  counts: Record<string, number>;
  protocolStatus: "TESTED_WITH_MOCK";
}

export class HistoryService {
  private readonly snapshots = new Map<string, HistorySnapshot>();

  public create(sessionId: string, payload: Record<string, unknown[]>): HistorySnapshot {
    const copied = copyPayload(payload);
    const counts: Record<string, number> = {};
    for (const [key, values] of Object.entries(copied)) counts[key] = values.length;
    const snapshot: HistorySnapshot = {
      snapshotId: crypto.randomUUID(),
      sessionId,
      createdAt: new Date().toISOString(),
      source: "mock-runtime",
      payload: copied,
      counts,
      protocolStatus: "TESTED_WITH_MOCK"
    };
    this.snapshots.set(snapshot.snapshotId, snapshot);
    return clone(snapshot);
  }

  public import(input: { sessionId: string; payload: Record<string, unknown[]> }): HistorySnapshot {
    const snapshot = this.create(input.sessionId, input.payload);
    const imported: HistorySnapshot = { ...snapshot, source: "imported-fixture" };
    this.snapshots.set(imported.snapshotId, imported);
    return clone(imported);
  }

  public list(sessionId: string): HistorySnapshot[] {
    return [...this.snapshots.values()].filter((snapshot) => snapshot.sessionId === sessionId).map(clone);
  }

  public get(sessionId: string, snapshotId: string): HistorySnapshot {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot || snapshot.sessionId !== sessionId) throw new OpenSrcWaError({ code: "HISTORY_SNAPSHOT_NOT_FOUND", category: "STORAGE_ERROR", message: "Snapshot history tidak ditemukan" });
    return clone(snapshot);
  }
}

function copyPayload(payload: Record<string, unknown[]>): Record<string, unknown[]> {
  const output: Record<string, unknown[]> = {};
  for (const [key, values] of Object.entries(payload)) output[key] = values.map((value) => structuredClone(value));
  return output;
}
function clone(snapshot: HistorySnapshot): HistorySnapshot { return { ...snapshot, payload: copyPayload(snapshot.payload), counts: { ...snapshot.counts } }; }

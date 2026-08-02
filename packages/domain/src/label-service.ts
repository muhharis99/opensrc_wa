import crypto = require("node:crypto");
import { OpenSrcWaError } from "../../core/src/errors";

export interface LabelRecord { labelId: string; sessionId: string; name: string; color: number; createdAt: string; updatedAt: string; }
export interface LabelAssignment { labelId: string; targetType: "chat" | "message"; targetId: string; assignedAt: string; }
export class LabelService {
  private readonly labels = new Map<string, LabelRecord>();
  private readonly assignments = new Map<string, LabelAssignment>();
  public create(sessionId: string, name: string, color: number): LabelRecord {
    const now = new Date().toISOString();
    const label: LabelRecord = { labelId: crypto.randomUUID(), sessionId, name, color, createdAt: now, updatedAt: now };
    this.labels.set(label.labelId, label);
    return { ...label };
  }
  public list(sessionId: string): LabelRecord[] { return [...this.labels.values()].filter((label) => label.sessionId === sessionId).map((label) => ({ ...label })); }
  public update(sessionId: string, labelId: string, patch: { name?: string; color?: number }): LabelRecord {
    const label = this.mutable(sessionId, labelId);
    if (patch.name !== undefined) label.name = patch.name;
    if (patch.color !== undefined) label.color = patch.color;
    label.updatedAt = new Date().toISOString();
    return { ...label };
  }
  public delete(sessionId: string, labelId: string): void {
    this.mutable(sessionId, labelId);
    this.labels.delete(labelId);
    for (const [key, assignment] of this.assignments) if (assignment.labelId === labelId) this.assignments.delete(key);
  }
  public assign(sessionId: string, labelId: string, targetType: LabelAssignment["targetType"], targetId: string, assigned: boolean): LabelAssignment[] {
    this.mutable(sessionId, labelId);
    const key = `${labelId}:${targetType}:${targetId}`;
    if (assigned) this.assignments.set(key, { labelId, targetType, targetId, assignedAt: new Date().toISOString() }); else this.assignments.delete(key);
    return this.listAssignments(labelId);
  }
  public listAssignments(labelId: string): LabelAssignment[] { return [...this.assignments.values()].filter((assignment) => assignment.labelId === labelId).map((assignment) => ({ ...assignment })); }
  private mutable(sessionId: string, labelId: string): LabelRecord {
    const label = this.labels.get(labelId);
    if (!label || label.sessionId !== sessionId) throw new OpenSrcWaError({ code: "LABEL_NOT_FOUND", category: "VALIDATION_ERROR", message: "Label tidak ditemukan" });
    return label;
  }
}

import type { AuditSnapshot } from "./types.js";
import { normalizeAuditSnapshot } from "./audit-snapshot.js";

export type SnapshotListener = (snapshot: AuditSnapshot) => void;

export class AuditStore {
  private snapshot: AuditSnapshot;
  private readonly listeners = new Set<SnapshotListener>();
  private destroyed = false;

  constructor(initial: AuditSnapshot = {}) { this.snapshot = normalizeAuditSnapshot(initial); }
  getSnapshot(): AuditSnapshot { return this.snapshot; }
  setSnapshot(next: AuditSnapshot): void {
    if (this.destroyed) return;
    this.snapshot = normalizeAuditSnapshot(next, this.snapshot);
    this.listeners.forEach((listener) => listener(this.snapshot));
  }
  subscribe(listener: SnapshotListener): () => void {
    if (this.destroyed) return () => undefined;
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  destroy(): void { this.destroyed = true; this.listeners.clear(); }
}

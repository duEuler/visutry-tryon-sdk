import type { AuditSnapshot } from "./types.js";

export type SnapshotListener = (snapshot: AuditSnapshot) => void;

export class AuditStore {
  private snapshot: AuditSnapshot;
  private readonly listeners = new Set<SnapshotListener>();

  constructor(initial: AuditSnapshot = {}) { this.snapshot = initial; }
  getSnapshot(): AuditSnapshot { return this.snapshot; }
  setSnapshot(next: AuditSnapshot): void {
    this.snapshot = next;
    this.listeners.forEach((listener) => listener(this.snapshot));
  }
  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  destroy(): void { this.listeners.clear(); }
}

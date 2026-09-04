import type { AuditSnapshot, StudioRuntimeAdapter } from "./types.js";
import { normalizeAuditSnapshot } from "./audit-snapshot.js";

/** Runtime no-op for previews, tests and degraded/offline Studio sessions. */
export function createStaticRuntimeAdapter(initial: AuditSnapshot = {}): StudioRuntimeAdapter {
  let snapshot: AuditSnapshot = normalizeAuditSnapshot({ ...initial, mode: "static" });
  const listeners = new Set<(next: AuditSnapshot) => void>();
  let disposed = false;
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) { if (disposed) return () => undefined; listeners.add(listener); return () => listeners.delete(listener); },
    initialize: async () => undefined,
    dispose() { disposed = true; listeners.clear(); },
    setSnapshot(next) {
      if (disposed) return;
      snapshot = normalizeAuditSnapshot({ ...next, mode: "static" }, snapshot);
      listeners.forEach((listener) => listener(snapshot));
    },
  };
}

import type { AuditSnapshot, StudioRuntimeAdapter } from "./types.js";

/** Runtime no-op for previews, tests and degraded/offline Studio sessions. */
export function createStaticRuntimeAdapter(initial: AuditSnapshot = {}): StudioRuntimeAdapter {
  let snapshot: AuditSnapshot = { mode: "static", ...initial };
  const listeners = new Set<(next: AuditSnapshot) => void>();
  let disposed = false;
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) { if (disposed) return () => undefined; listeners.add(listener); return () => listeners.delete(listener); },
    initialize: async () => undefined,
    dispose() { disposed = true; listeners.clear(); },
    setSnapshot(next) {
      if (disposed) return;
      snapshot = { ...snapshot, ...next, mode: "static" };
      listeners.forEach((listener) => listener(snapshot));
    },
  };
}

import type { AuditSnapshot, StudioRuntimeAdapter } from "./types.js";

/** Runtime no-op for previews, tests and degraded/offline Studio sessions. */
export function createStaticRuntimeAdapter(initial: AuditSnapshot = {}): StudioRuntimeAdapter {
  let snapshot: AuditSnapshot = { mode: "static", ...initial };
  const listeners = new Set<(next: AuditSnapshot) => void>();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    initialize: async () => undefined,
    dispose() { listeners.clear(); },
    setSnapshot(next) {
      snapshot = { ...snapshot, ...next, mode: "static" };
      listeners.forEach((listener) => listener(snapshot));
    },
  } as StudioRuntimeAdapter & { setSnapshot(next: AuditSnapshot): void };
}

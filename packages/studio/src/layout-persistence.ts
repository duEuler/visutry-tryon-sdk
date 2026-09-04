import type { LayoutPersistence, PersistedStudioState } from "./types.js";

function isLayout(value: unknown): value is PersistedStudioState["layout"] {
  return typeof value === "object" && value !== null && "root" in value;
}

function readState(raw: string, version: number): PersistedStudioState | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedStudioState>;
    // Older Studio snapshots did not persist these arrays. Treat them as an
    // empty migration rather than rejecting an otherwise valid layout.
    if (parsed.version !== version || !isLayout(parsed.layout)) return null;
    return {
      version,
      layout: parsed.layout,
      hiddenPanels: Array.isArray(parsed.hiddenPanels) ? parsed.hiddenPanels.filter((id): id is string => typeof id === "string") : [],
      collapsedPanels: Array.isArray(parsed.collapsedPanels) ? parsed.collapsedPanels.filter((id): id is string => typeof id === "string") : [],
    };
  } catch {
    return null;
  }
}

export function createLocalStoragePersistence(key: string, version: number): LayoutPersistence {
  return {
    load() {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        return readState(raw, version)?.layout ?? null;
      } catch { return null; }
    },
    save(layout) { localStorage.setItem(key, JSON.stringify({ version, layout, hiddenPanels: [], collapsedPanels: [] } satisfies PersistedStudioState)); },
    loadState() {
      const raw = localStorage.getItem(key);
      return raw ? readState(raw, version) : null;
    },
    saveState(state) { localStorage.setItem(key, JSON.stringify({ ...state, version } satisfies PersistedStudioState)); },
    clear() { localStorage.removeItem(key); },
  };
}

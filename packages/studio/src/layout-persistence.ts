import type { LayoutPersistence, PersistedStudioState } from "./types.js";

function isLayout(value: unknown): value is PersistedStudioState["layout"] {
  return typeof value === "object" && value !== null && "root" in value;
}

function readState(raw: string, version: number): PersistedStudioState | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedStudioState>;
    // Older Studio snapshots did not persist these arrays. Treat them as an
    // empty migration rather than rejecting an otherwise valid layout.
    const isCurrent = parsed.version === version;
    const isPrevious = parsed.version === version - 1;
    if ((!isCurrent && !isPrevious) || !isLayout(parsed.layout)) return null;
    const panelIds = (value: unknown): string[] => Array.isArray(value)
      ? [...new Set(value.filter((id): id is string => typeof id === "string" && id.trim().length > 0))]
      : [];
    return {
      version,
      layout: parsed.layout,
      hiddenPanels: panelIds(parsed.hiddenPanels),
      collapsedPanels: panelIds(parsed.collapsedPanels),
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
    save(layout) {
      try { localStorage.setItem(key, JSON.stringify({ version, layout, hiddenPanels: [], collapsedPanels: [] } satisfies PersistedStudioState)); }
      catch { /* storage indisponível não pode interromper o Studio */ }
    },
    loadState() {
      try {
        const raw = localStorage.getItem(key);
        return raw ? readState(raw, version) : null;
      } catch { return null; }
    },
    saveState(state) {
      try { localStorage.setItem(key, JSON.stringify({ ...state, version } satisfies PersistedStudioState)); }
      catch { /* storage indisponível não pode interromper o Studio */ }
    },
    clear() { try { localStorage.removeItem(key); } catch { /* best effort */ } },
  };
}

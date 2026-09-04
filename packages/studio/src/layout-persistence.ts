import type { LayoutPersistence, PersistedStudioState } from "./types.js";

export function createLocalStoragePersistence(key: string, version: number): LayoutPersistence {
  return {
    load() {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as PersistedStudioState;
        return parsed.version === version && parsed.layout ? parsed.layout : null;
      } catch { return null; }
    },
    save(layout) { localStorage.setItem(key, JSON.stringify({ version, layout, hiddenPanels: [], collapsedPanels: [] } satisfies PersistedStudioState)); },
    loadState() {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<PersistedStudioState>;
        if (parsed.version !== version || !parsed.layout) return null;
        return { version, layout: parsed.layout, hiddenPanels: parsed.hiddenPanels ?? [], collapsedPanels: parsed.collapsedPanels ?? [] };
      } catch { return null; }
    },
    saveState(state) { localStorage.setItem(key, JSON.stringify({ ...state, version } satisfies PersistedStudioState)); },
    clear() { localStorage.removeItem(key); },
  };
}

import type { LayoutPersistence, LayoutPersistenceOptions, PersistedStudioState } from "./types.js";

function isLayout(value: unknown): value is PersistedStudioState["layout"] {
  return typeof value === "object" && value !== null && "root" in value;
}

function readState(raw: string, version: number, options: LayoutPersistenceOptions): PersistedStudioState | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedStudioState>;
    const parsedVersion = parsed.version;
    if (typeof parsedVersion !== "number" || !Number.isInteger(parsedVersion) || parsedVersion > version || !isLayout(parsed.layout)) return null;
    const panelIds = (value: unknown): string[] => Array.isArray(value)
      ? [...new Set(value.filter((id): id is string => typeof id === "string" && id.trim().length > 0))]
      : [];
    let state: PersistedStudioState = {
      version,
      layout: parsed.layout,
      hiddenPanels: panelIds(parsed.hiddenPanels),
      collapsedPanels: panelIds(parsed.collapsedPanels),
    };
    if (parsedVersion !== version) {
      const sourceVersion = parsedVersion as number;
      const migration = options.migrations?.[sourceVersion];
      if (sourceVersion !== version - 1 && !migration) return null;
      if (migration) {
        const migrated = migration({ ...state, version: sourceVersion });
        if (!migrated || !isLayout(migrated.layout)) return null;
        state = { ...migrated, version };
      }
    }
    return state;
  } catch {
    return null;
  }
}

export function createLocalStoragePersistence(key: string, version: number, options: LayoutPersistenceOptions = {}): LayoutPersistence {
  return {
    load() {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        return readState(raw, version, options)?.layout ?? null;
      } catch { return null; }
    },
    save(layout) {
      try { localStorage.setItem(key, JSON.stringify({ version, layout, hiddenPanels: [], collapsedPanels: [] } satisfies PersistedStudioState)); }
      catch { /* storage indisponível não pode interromper o Studio */ }
    },
    loadState() {
      try {
        const raw = localStorage.getItem(key);
        return raw ? readState(raw, version, options) : null;
      } catch { return null; }
    },
    saveState(state) {
      try { localStorage.setItem(key, JSON.stringify({ ...state, version } satisfies PersistedStudioState)); }
      catch { /* storage indisponível não pode interromper o Studio */ }
    },
    clear() { try { localStorage.removeItem(key); } catch { /* best effort */ } },
  };
}

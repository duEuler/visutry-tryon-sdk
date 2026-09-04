import type { LayoutConfig } from "golden-layout";
import type { LayoutPersistence } from "./types.js";

export interface PersistedStudioState { version: number; layout: LayoutConfig }

export function createLocalStoragePersistence(key: string, version: number): LayoutPersistence {
  return {
    load() {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as PersistedStudioState;
        return parsed.version === version ? parsed.layout : null;
      } catch { return null; }
    },
    save(layout) { localStorage.setItem(key, JSON.stringify({ version, layout } satisfies PersistedStudioState)); },
    clear() { localStorage.removeItem(key); },
  };
}

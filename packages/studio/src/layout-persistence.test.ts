import { describe, expect, it } from "vitest";
import { createLocalStoragePersistence } from "./layout-persistence.js";

describe("createLocalStoragePersistence", () => {
  it("round-trips versioned layout state and falls back on invalid JSON", () => {
    const persistence = createLocalStoragePersistence("studio-test", 3);
    const layout = { root: { type: "row", content: [] } } as never;
    persistence.saveState?.({ version: 3, layout, hiddenPanels: ["camera"], collapsedPanels: ["rightDock"] });
    expect(persistence.loadState?.()).toMatchObject({ version: 3, hiddenPanels: ["camera"], collapsedPanels: ["rightDock"] });
    localStorage.setItem("studio-test", "{");
    expect(persistence.loadState?.()).toBeNull();
  });
});

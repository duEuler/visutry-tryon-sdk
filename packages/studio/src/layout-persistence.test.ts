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

  it("migrates legacy snapshots without panel state arrays", () => {
    const persistence = createLocalStoragePersistence("studio-legacy", 1);
    const layout = { root: { type: "row", content: [] } } as never;
    localStorage.setItem("studio-legacy", JSON.stringify({ version: 1, layout }));
    expect(persistence.loadState?.()).toEqual({ version: 1, layout, hiddenPanels: [], collapsedPanels: [] });
  });

  it("rejects snapshots with malformed layouts or panel ids", () => {
    const persistence = createLocalStoragePersistence("studio-malformed", 1);
    localStorage.setItem("studio-malformed", JSON.stringify({ version: 1, layout: { nope: true }, hiddenPanels: ["camera", 4] }));
    expect(persistence.loadState?.()).toBeNull();
  });

  it("migrates the immediately previous persistence version", () => {
    const persistence = createLocalStoragePersistence("studio-previous", 7);
    localStorage.setItem("studio-previous", JSON.stringify({ version: 6, layout: { root: { type: "row", content: [] } } }));
    expect(persistence.loadState?.()).toMatchObject({ version: 7, hiddenPanels: [], collapsedPanels: [] });
  });

  it("rejects unknown future versions", () => {
    const persistence = createLocalStoragePersistence("studio-future", 7);
    localStorage.setItem("studio-future", JSON.stringify({ version: 8, layout: { root: { type: "row", content: [] } } }));
    expect(persistence.loadState?.()).toBeNull();
  });

  it("applies an explicit migration for older versions", () => {
    const persistence = createLocalStoragePersistence("studio-migration", 4, {
      migrations: {
        1: (state) => ({ ...state, hiddenPanels: ["camera"], collapsedPanels: [] }),
      },
    });
    localStorage.setItem("studio-migration", JSON.stringify({ version: 1, layout: { root: { type: "row", content: [] } } }));
    expect(persistence.loadState?.()).toMatchObject({ version: 4, hiddenPanels: ["camera"] });
  });

  it("sanitizes duplicate and empty panel ids during migration", () => {
    const persistence = createLocalStoragePersistence("studio-panel-ids", 2);
    localStorage.setItem("studio-panel-ids", JSON.stringify({
      version: 2,
      layout: { root: { type: "row", content: [] } },
      hiddenPanels: ["camera", "camera", "", 4],
      collapsedPanels: ["rightDock", "rightDock", "  "],
    }));
    expect(persistence.loadState?.()).toMatchObject({ hiddenPanels: ["camera"], collapsedPanels: ["rightDock"] });
  });

  it("does not throw when storage writes fail", () => {
    const persistence = createLocalStoragePersistence("studio-write-failure", 1);
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error("quota"); };
    expect(() => persistence.save({ root: { type: "row", content: [] } } as never)).not.toThrow();
    expect(() => persistence.saveState?.({ version: 1, layout: { root: { type: "row", content: [] } } as never, hiddenPanels: [], collapsedPanels: [] })).not.toThrow();
    Storage.prototype.setItem = original;
  });
});

import { describe, expect, it } from "vitest";
import { createDefaultStudioLayout, normalizeStudioLayout } from "./layout-contract.js";

describe("createDefaultStudioLayout", () => {
  it("keeps side docks full height and bottom panels in the center column", () => {
    const root = createDefaultStudioLayout().root as any;
    expect(root.type).toBe("row");
    expect(root.content.map((item: any) => item.componentType)).toEqual(["leftDock", undefined, "rightDock"]);
    const center = root.content[1];
    expect(center.type).toBe("column");
    expect(center.content[0].content.map((item: any) => item.componentType)).toEqual(["live", "viewports"]);
    expect(center.content[1].content.map((item: any) => item.componentType)).toEqual(["evidence", "selected"]);
    expect(center.content[1].height).toBe(18);
  });
});

describe("normalizeStudioLayout", () => {
  it("removes resolved Golden Layout fields while preserving the declarative tree", () => {
    const normalized = normalizeStudioLayout({
      root: {
        type: "stack",
        content: [{ type: "component", componentType: "live", title: "Live 3D", id: "internal", resolved: true, componentState: {} }],
        id: "resolved-stack",
        isClosable: true,
      },
      openPopouts: [],
      settings: { constrainDragToContainer: true },
    } as any);
    expect(normalized).toEqual({ root: { type: "stack", content: [{ type: "component", componentType: "live", title: "Live 3D" }] } });
  });

  it("rejects trees without a valid component node", () => {
    expect(() => normalizeStudioLayout({ root: { type: "row", content: [{ type: "component" }] } } as any)).toThrow("Invalid Studio layout root");
  });

  it("returns a reusable declarative layout shape", () => {
    const layout = normalizeStudioLayout({ root: { type: "component", componentType: "live", id: "resolved" } } as any);
    expect(layout.root).toEqual({ type: "component", componentType: "live" });
  });

  it("preserves the active tab index in a stack", () => {
    const layout = normalizeStudioLayout({ root: {
      type: "stack", activeItem: 1, id: "resolved-stack", content: [
        { type: "component", componentType: "live", id: "runtime-live" },
        { type: "component", componentType: "viewports" },
      ],
    } } as any);
    expect(layout.root).toEqual({
      type: "stack", activeItem: 1, content: [
        { type: "component", componentType: "live" },
        { type: "component", componentType: "viewports" },
      ],
    });
  });
});

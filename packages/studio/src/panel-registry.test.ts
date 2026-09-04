import { describe, expect, it, vi } from "vitest";
import { createPanelRegistry } from "./panel-registry.js";

describe("StudioPanelRegistry", () => {
  it("registers, discovers and updates isolated definitions", () => {
    const create = vi.fn();
    const update = vi.fn();
    const definition = { id: "camera", title: "Camera", region: "left" as const, scrollable: true, create, update };
    const registry = createPanelRegistry([definition]);
    expect(registry.list()).toHaveLength(1);
    expect(registry.get("camera")).toBe(definition);
    const element = document.createElement("div");
    registry.update("camera", element, { mode: "static" });
    expect(update).toHaveBeenCalledWith(element, { mode: "static" });
  });

  it("rejects duplicate panel ids instead of overwriting definitions", () => {
    const definition = { id: "camera", title: "Camera", region: "left" as const, scrollable: true, create: vi.fn() };
    const registry = createPanelRegistry([definition]);
    expect(() => registry.register(definition)).toThrow(/Duplicate Studio panel id/);
  });
});

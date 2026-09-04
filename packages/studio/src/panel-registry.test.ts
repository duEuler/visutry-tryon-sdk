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

  it("unregisters dynamic panels without affecting the remaining registry", () => {
    const definition = { id: "dynamic", title: "Dynamic", region: "center" as const, scrollable: false, create: vi.fn() };
    const registry = createPanelRegistry([definition]);
    expect(registry.unregister("dynamic")).toBe(true);
    expect(registry.get("dynamic")).toBeUndefined();
    expect(registry.unregister("dynamic")).toBe(false);
  });

  it("rejects malformed runtime definitions", () => {
    expect(() => createPanelRegistry([{ id: "", title: "", region: "left", scrollable: false, create: vi.fn() } as never])).toThrow(/id is required/);
    expect(() => createPanelRegistry([{ id: "bad", title: "Bad", region: "floating", scrollable: false, create: vi.fn() } as never])).toThrow(/Invalid Studio panel region/);
    expect(() => createPanelRegistry([{ id: "scroll", title: "Scroll", region: "left", create: vi.fn() } as never])).toThrow(/scrollable flag is required/);
    expect(() => createPanelRegistry([{ id: "factory", title: "Factory", region: "center", scrollable: false } as never])).toThrow(/factory is required/);
  });
});

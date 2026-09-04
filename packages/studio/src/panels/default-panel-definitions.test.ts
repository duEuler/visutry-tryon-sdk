import { describe, expect, it, vi } from "vitest";
import { createDefaultPanelDefinitions } from "./default-panel-definitions.js";

describe("createDefaultPanelDefinitions", () => {
  it("exposes the desktop regions and scroll contract", () => {
    const definitions = createDefaultPanelDefinitions({ collapsePanel: vi.fn(), expandPanel: vi.fn() });
    expect(definitions.map((definition) => definition.id)).toEqual(["leftDock", "rightDock", "live", "viewports", "evidence", "selected"]);
    expect(definitions.map((definition) => definition.region)).toEqual(["left", "right", "center", "center", "bottom", "bottom"]);
    expect(definitions.filter((definition) => definition.scrollable).map((definition) => definition.id)).toEqual(["leftDock", "rightDock"]);
  });

  it("renders selected evidence identifiers as text", () => {
    const definition = createDefaultPanelDefinitions({ collapsePanel: vi.fn(), expandPanel: vi.fn() }).find((item) => item.id === "selected");
    const element = document.createElement("section");
    element.innerHTML = '<div class="panel-body"><div>placeholder</div></div>';
    definition?.update?.(element, { evidence: [{ id: "<img src=x onerror=alert(1)>", timestamp: 1 }], selectedFrameId: "<img src=x onerror=alert(1)>" });
    expect(element.querySelector("img")).toBeNull();
    expect(element.querySelector(".panel-body")?.textContent).toContain("<img src=x onerror=alert(1)>");
  });

  it("clears runtime values and evidence while static", () => {
    const definition = createDefaultPanelDefinitions({ collapsePanel: vi.fn(), expandPanel: vi.fn() }).find((item) => item.id === "evidence");
    const element = document.createElement("section");
    element.dataset.panelId = "evidence";
    element.innerHTML = '<div class="panel-body"><div class="timeline"><span>old frame</span></div><strong>95%</strong></div>';
    definition?.update?.(element, { mode: "static", evidence: [{ id: "old", timestamp: 1 }] });
    expect(element.classList.contains("studio-panel--inactive")).toBe(true);
    expect(element.querySelector("strong")?.textContent).toBe("—");
    expect(element.querySelector(".timeline-empty")?.textContent).toContain("Nenhuma evidência");
  });

  it("projects connected snapshot values into runtime fields", () => {
    const definitions = createDefaultPanelDefinitions({ collapsePanel: vi.fn(), expandPanel: vi.fn() });
    const glb = definitions.find((item) => item.id === "rightDock");
    const element = document.createElement("section");
    element.innerHTML = '<strong data-studio-field="glb-name">old</strong><strong data-studio-field="glb-file">old</strong><strong data-studio-field="glb-visibility">old</strong>';
    glb?.update?.(element, { mode: "connected", glb: { name: "New Model", modelUrl: "/new.glb" } });
    expect(element.querySelector('[data-studio-field="glb-name"]')?.textContent).toBe("New Model");
    expect(element.querySelector('[data-studio-field="glb-file"]')?.textContent).toBe("/new.glb");
    expect(element.querySelector('[data-studio-field="glb-visibility"]')?.textContent).toBe("Exibindo");
  });
});

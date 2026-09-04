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
});

import { describe, expect, it, vi } from "vitest";
import { createDefaultPanelDefinitions } from "./default-panel-definitions.js";

describe("createDefaultPanelDefinitions", () => {
  it("exposes the desktop regions and scroll contract", () => {
    const definitions = createDefaultPanelDefinitions({ collapsePanel: vi.fn(), expandPanel: vi.fn() });
    expect(definitions.map((definition) => definition.id)).toEqual(["leftDock", "rightDock", "live", "viewports", "evidence", "selected"]);
    expect(definitions.map((definition) => definition.region)).toEqual(["left", "right", "center", "center", "bottom", "bottom"]);
    expect(definitions.filter((definition) => definition.scrollable).map((definition) => definition.id)).toEqual(["leftDock", "rightDock"]);
  });
});

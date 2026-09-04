import { describe, expect, it } from "vitest";
import { itemContent, itemControls, panelElement, panelItem } from "./golden-layout-dom.js";

describe("Golden Layout DOM boundary", () => {
  it("resolves a panel tree without interpolating panel ids into selectors", () => {
    const host = document.createElement("main");
    host.innerHTML = '<div class="lm_item"><div class="lm_content"><section data-panel-id="leftDock"></section></div><div class="lm_controls"></div></div>';
    const panel = panelElement(host, "leftDock");
    const item = panelItem(panel);
    expect(panel).toBeTruthy();
    expect(itemContent(item)).toBeTruthy();
    expect(itemControls(item)).toBeTruthy();
    expect(panelElement(host, 'bad" ]')).toBeNull();
  });
});

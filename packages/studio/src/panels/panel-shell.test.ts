import { describe, expect, it } from "vitest";
import { createPanelShell } from "./panel-shell.js";

describe("createPanelShell", () => {
  it("applies the explicit scroll contract when requested", () => {
    const host = document.createElement("div");
    createPanelShell({ panelId: "metrics", getSnapshot: () => ({}) }, { element: host } as never, { panelId: "metrics", body: "<p>ok</p>", scrollable: true });
    expect(host.querySelector("section")?.classList.contains("studio-panel--scrollable")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { createAccordionPanel } from "./accordion-panel.js";

describe("createAccordionPanel", () => {
  it("declares the scrollable panel contract at the factory boundary", () => {
    const host = document.createElement("div");
    createAccordionPanel(
      { panelId: "leftDock", getSnapshot: () => ({}) },
      { element: host } as never,
      [{ id: "camera", title: "Câmera", body: "<p>ok</p>" }],
    );

    expect(host.querySelector(".studio-panel")?.classList.contains("studio-panel--scrollable")).toBe(true);
    expect(host.querySelector(".accordion")).toBeTruthy();
  });
});

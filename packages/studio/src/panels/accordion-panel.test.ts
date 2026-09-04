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

  it("aborts accordion listeners when the Golden Layout container is destroyed", () => {
    const host = document.createElement("div");
    let destroy: (() => void) | undefined;
    const container = { element: host, on: (_event: string, listener: () => void) => { destroy = listener; } } as never;
    createAccordionPanel(
      { panelId: "leftDock", getSnapshot: () => ({}) },
      container,
      [{ id: "camera", title: "Câmera", body: "<p>ok</p>" }],
    );
    const trigger = host.querySelector<HTMLButtonElement>(".accordion-trigger")!;
    destroy?.();
    trigger.click();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });
});

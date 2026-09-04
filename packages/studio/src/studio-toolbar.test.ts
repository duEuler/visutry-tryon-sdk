import { describe, expect, it, vi } from "vitest";
import { bindStudioToolbar } from "./studio-toolbar.js";

function studioMock() {
  let locked = false;
  return {
    saveLayout: vi.fn(), restoreDefaultLayout: vi.fn(), expandPanel: vi.fn(), collapsePanel: vi.fn(),
    showPanel: vi.fn(), hidePanel: vi.fn(), setLayoutLocked: vi.fn((next: boolean) => { locked = next; }),
    isLayoutLocked: vi.fn(() => locked),
  } as never;
}

describe("bindStudioToolbar", () => {
  it("binds declarative actions and removes listeners on dispose", () => {
    document.body.innerHTML = '<button data-studio-action="save"></button><button data-studio-action="restore"></button><button data-studio-action="expand"></button><button data-studio-action="collapse"></button><button data-studio-action="show-side-panels"></button><button data-studio-action="hide-side-panels"></button><button data-studio-action="lock">Bloquear layout</button>';
    const studio = studioMock();
    const binding = bindStudioToolbar(document, studio);
    document.querySelector<HTMLButtonElement>('[data-studio-action="save"]')!.click();
    document.querySelector<HTMLButtonElement>('[data-studio-action="restore"]')!.click();
    document.querySelector<HTMLButtonElement>('[data-studio-action="expand"]')!.click();
    document.querySelector<HTMLButtonElement>('[data-studio-action="collapse"]')!.click();
    document.querySelector<HTMLButtonElement>('[data-studio-action="show-side-panels"]')!.click();
    document.querySelector<HTMLButtonElement>('[data-studio-action="hide-side-panels"]')!.click();
    document.querySelector<HTMLButtonElement>('[data-studio-action="lock"]')!.click();
    expect(studio.saveLayout).toHaveBeenCalledOnce();
    expect(studio.restoreDefaultLayout).toHaveBeenCalledOnce();
    expect(studio.expandPanel).toHaveBeenCalledWith("leftDock");
    expect(studio.collapsePanel).toHaveBeenCalledWith("leftDock");
    expect(studio.showPanel).toHaveBeenCalledWith("leftDock");
    expect(studio.hidePanel).toHaveBeenCalledWith("leftDock");
    expect(studio.setLayoutLocked).toHaveBeenCalledWith(true);
    binding.dispose();
    document.querySelector<HTMLButtonElement>('[data-studio-action="save"]')!.click();
    expect(studio.saveLayout).toHaveBeenCalledOnce();
  });

  it("supports custom accordion panel ids", () => {
    document.body.innerHTML = '<button data-studio-action="collapse"></button>';
    const studio = studioMock();
    const binding = bindStudioToolbar(document, studio, { accordionPanelIds: ["inspector", "diagnostics"] });
    document.querySelector<HTMLButtonElement>('[data-studio-action="collapse"]')!.click();
    expect(studio.collapsePanel).toHaveBeenNthCalledWith(1, "inspector");
    expect(studio.collapsePanel).toHaveBeenNthCalledWith(2, "diagnostics");
    binding.dispose();
  });
});

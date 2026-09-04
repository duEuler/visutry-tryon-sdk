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
    document.body.innerHTML = '<button data-studio-action="save"></button><button data-studio-action="lock">Bloquear layout</button>';
    const studio = studioMock();
    const binding = bindStudioToolbar(document, studio);
    document.querySelector<HTMLButtonElement>('[data-studio-action="save"]')!.click();
    document.querySelector<HTMLButtonElement>('[data-studio-action="lock"]')!.click();
    expect(studio.saveLayout).toHaveBeenCalledOnce();
    expect(studio.setLayoutLocked).toHaveBeenCalledWith(true);
    binding.dispose();
    document.querySelector<HTMLButtonElement>('[data-studio-action="save"]')!.click();
    expect(studio.saveLayout).toHaveBeenCalledOnce();
  });
});

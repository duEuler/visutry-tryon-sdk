import type { StudioInstance } from "./types.js";

export interface StudioToolbarBinding {
  dispose(): void;
}

/** Binds declarative toolbar actions to a Studio instance. */
export function bindStudioToolbar(root: ParentNode, studio: StudioInstance): StudioToolbarBinding {
  const listeners: Array<() => void> = [];
  const on = (selector: string, handler: (button: HTMLButtonElement) => void) => {
    const button = root.querySelector<HTMLButtonElement>(selector);
    if (!button) return;
    const listener = () => handler(button);
    button.addEventListener("click", listener);
    listeners.push(() => button.removeEventListener("click", listener));
  };
  on('[data-studio-action="save"]', () => studio.saveLayout());
  on('[data-studio-action="restore"]', () => studio.restoreDefaultLayout());
  on('[data-studio-action="expand"]', () => { studio.expandPanel("leftDock"); studio.expandPanel("rightDock"); });
  on('[data-studio-action="collapse"]', () => { studio.collapsePanel("leftDock"); studio.collapsePanel("rightDock"); });
  on('[data-studio-action="show-side-panels"]', () => { studio.showPanel("leftDock"); studio.showPanel("rightDock"); });
  on('[data-studio-action="hide-side-panels"]', () => { studio.hidePanel("leftDock"); studio.hidePanel("rightDock"); });
  on('[data-studio-action="lock"]', (button) => {
    const locked = !studio.isLayoutLocked();
    studio.setLayoutLocked(locked);
    button.textContent = locked ? "Desbloquear layout" : "Bloquear layout";
    button.setAttribute("aria-pressed", String(locked));
  });
  return { dispose() { listeners.splice(0).forEach((remove) => remove()); } };
}

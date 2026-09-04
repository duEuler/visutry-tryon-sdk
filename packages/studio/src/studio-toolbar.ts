import type { StudioInstance } from "./types.js";

export interface StudioToolbarBinding {
  dispose(): void;
}

export interface StudioToolbarOptions {
  accordionPanelIds?: string[];
}

/** Binds declarative toolbar actions to a Studio instance. */
export function bindStudioToolbar(root: ParentNode, studio: StudioInstance, options: StudioToolbarOptions = {}): StudioToolbarBinding {
  const panelIds = options.accordionPanelIds ?? ["leftDock", "rightDock"];
  const listeners: Array<() => void> = [];
  const on = (selector: string, handler: (button: HTMLButtonElement) => void) => {
    root.querySelectorAll<HTMLButtonElement>(selector).forEach((button) => {
      const listener = () => handler(button);
      button.addEventListener("click", listener);
      listeners.push(() => button.removeEventListener("click", listener));
    });
  };
  on('[data-studio-action="save"]', () => studio.saveLayout());
  on('[data-studio-action="restore"]', () => studio.restoreDefaultLayout());
  on('[data-studio-action="expand"]', () => panelIds.forEach((id) => studio.expandPanel(id)));
  on('[data-studio-action="collapse"]', () => panelIds.forEach((id) => studio.collapsePanel(id)));
  on('[data-studio-action="show-side-panels"]', () => panelIds.forEach((id) => studio.showPanel(id)));
  on('[data-studio-action="hide-side-panels"]', () => panelIds.forEach((id) => studio.hidePanel(id)));
  on('[data-studio-action="show-panel"][data-studio-panel]', (button) => {
    const id = button.dataset.studioPanel;
    if (id) studio.showPanel(id);
  });
  on('[data-studio-action="hide-panel"][data-studio-panel]', (button) => {
    const id = button.dataset.studioPanel;
    if (id) studio.hidePanel(id);
  });
  on('[data-studio-action="lock"]', (button) => {
    const locked = !studio.isLayoutLocked();
    studio.setLayoutLocked(locked);
    button.textContent = locked ? "Desbloquear layout" : "Bloquear layout";
    button.setAttribute("aria-pressed", String(locked));
  });
  return { dispose() { listeners.splice(0).forEach((remove) => remove()); } };
}

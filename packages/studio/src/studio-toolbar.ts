import type { StudioInstance } from "./types.js";

export interface StudioToolbarBinding {
  dispose(): void;
  setEnabled(enabled: boolean): void;
}

export interface StudioToolbarOptions {
  accordionPanelIds?: string[];
  /** Disable all bound controls while the host is unavailable. */
  enabled?: boolean;
}

/** Binds declarative toolbar actions to a Studio instance. */
export function bindStudioToolbar(root: ParentNode, studio: StudioInstance, options: StudioToolbarOptions = {}): StudioToolbarBinding {
  const panelIds = options.accordionPanelIds ?? ["leftDock", "rightDock"];
  const listeners: Array<() => void> = [];
  const controls = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-studio-action]"));
  let enabled = options.enabled !== false;
  const setEnabled = (next: boolean) => {
    enabled = next;
    controls.forEach((button) => {
      button.disabled = !enabled;
      button.setAttribute("aria-disabled", String(!enabled));
    });
  };
  setEnabled(enabled);
  const on = (selector: string, handler: (button: HTMLButtonElement) => void) => {
    root.querySelectorAll<HTMLButtonElement>(selector).forEach((button) => {
      const listener = () => { if (enabled) handler(button); };
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
  return { dispose() { listeners.splice(0).forEach((remove) => remove()); }, setEnabled };
}

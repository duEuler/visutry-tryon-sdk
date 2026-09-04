import type { ComponentContainer } from "golden-layout";
import type { StudioPanelContext } from "../types.js";

export interface PanelShellOptions { panelId: string; body: string; accordion?: boolean; scrollable?: boolean; }

export function createPanelShell(context: StudioPanelContext, container: ComponentContainer, options: PanelShellOptions): HTMLElement {
  void context;
  const classes = ["studio-panel", "gl-panel", options.accordion ? "gl-panel--accordion" : "", options.scrollable ? "studio-panel--scrollable" : ""].filter(Boolean).join(" ");
  container.element.innerHTML = `<section class="${classes}" data-panel-id="${options.panelId}"><div class="panel-body">${options.body}</div></section>`;
  return container.element;
}

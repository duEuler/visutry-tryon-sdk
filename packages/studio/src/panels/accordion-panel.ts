import type { ComponentContainer } from "golden-layout";
import type { StudioPanelContext } from "../types.js";

export interface AccordionSection { id: string; title: string; body: string; }

export function renderAccordion(sections: AccordionSection[]): string {
  return `<div class="accordion">${sections.map((section) => {
    const contentId = `accordion-content-${section.id}`;
    return `<article class="accordion-item is-open"><button class="accordion-trigger" type="button" aria-expanded="true" aria-controls="${contentId}"><span>${section.title}</span><span aria-hidden="true">−</span></button><div id="${contentId}" class="accordion-content" role="region" aria-label="${section.title}">${section.body}</div></article>`;
  }).join("")}</div>`;
}

export function bindAccordion(container: ComponentContainer | HTMLElement, signal?: AbortSignal): void {
  const root = container instanceof HTMLElement ? container : container.element;
  root.querySelectorAll<HTMLButtonElement>(".accordion-trigger").forEach((trigger) => trigger.addEventListener("click", () => {
    const item = trigger.closest(".accordion-item");
    const open = item?.classList.toggle("is-open") ?? false;
    trigger.setAttribute("aria-expanded", String(open));
    if (trigger.lastElementChild) trigger.lastElementChild.textContent = open ? "−" : "+";
  }, signal ? { signal } : undefined));
}

export function createAccordionPanel(context: StudioPanelContext, container: ComponentContainer, sections: AccordionSection[]): HTMLElement {
  container.element.innerHTML = `<section class="studio-panel studio-panel--scrollable gl-panel gl-panel--accordion" data-panel-id="${context.panelId}"><div class="panel-body">${renderAccordion(sections)}</div></section>`;
  const controller = new AbortController();
  bindAccordion(container, controller.signal);
  if (typeof container.on === "function") container.on("destroy", () => controller.abort());
  return container.element;
}

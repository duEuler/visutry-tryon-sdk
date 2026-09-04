/** Golden Layout DOM boundary kept in one place for host and consumers. */
export function panelElement(host: HTMLElement, id: string): HTMLElement | null {
  return [...host.querySelectorAll<HTMLElement>("[data-panel-id]")].find((element) => element.dataset.panelId === id) ?? null;
}

export function panelItem(panel: HTMLElement | null): HTMLElement | null {
  return panel?.closest<HTMLElement>(".lm_item") ?? null;
}

export function itemContent(item: HTMLElement | null): HTMLElement | null {
  return item?.querySelector<HTMLElement>(".lm_content") ?? null;
}

export function itemControls(item: HTMLElement | null): HTMLElement | null {
  return item?.querySelector<HTMLElement>(".lm_controls") ?? null;
}

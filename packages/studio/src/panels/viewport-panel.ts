export interface ViewportDefinition { label: string; body: string; }
export function renderViewportGrid(viewports: ViewportDefinition[]): string {
  return `<div class="viewport-grid">${viewports.map((viewport) => `<div class="mini"><strong>${viewport.label}</strong>${viewport.body}</div>`).join("")}</div>`;
}

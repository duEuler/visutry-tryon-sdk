export interface MetricItem { label: string; value: string; status?: boolean; }
const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] ?? character));

export function renderMetricGrid(items: MetricItem[]): string {
  return `<div class="metric-grid">${items.map((item) => `<div class="metric"><label>${escapeHtml(item.label)}</label><strong${item.status ? " class=\"status\"" : ""}>${escapeHtml(item.value)}</strong></div>`).join("")}</div>`;
}

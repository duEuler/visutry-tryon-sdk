export interface MetricItem { label: string; value: string; status?: boolean; }
export function renderMetricGrid(items: MetricItem[]): string {
  return `<div class="metric-grid">${items.map((item) => `<div class="metric"><label>${item.label}</label><strong${item.status ? " class=\"status\"" : ""}>${item.value}</strong></div>`).join("")}</div>`;
}

export interface EvidenceItem { label: string; best?: boolean; }
export function renderEvidenceTimeline(items: EvidenceItem[]): string {
  return `<div class="timeline">${items.map((item) => `<div class="thumb${item.best ? " best" : ""}">${item.label}</div>`).join("")}</div>`;
}

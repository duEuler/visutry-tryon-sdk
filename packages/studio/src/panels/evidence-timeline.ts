export interface EvidenceItem { label: string; best?: boolean; dataUrl?: string; }

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function safeImage(dataUrl: string | undefined): string {
  return dataUrl && /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(dataUrl)
    ? `<img class="thumb-image" src="${dataUrl}" alt="" loading="lazy" />`
    : "";
}
export function renderEvidenceTimeline(items: EvidenceItem[]): string {
  return `<div class="timeline">${items.map((item) => `<div class="thumb${item.best ? " best" : ""}">${safeImage(item.dataUrl)}<span>${escapeHtml(item.label)}</span></div>`).join("")}</div>`;
}

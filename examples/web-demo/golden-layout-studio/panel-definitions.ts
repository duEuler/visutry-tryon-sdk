import type { ComponentContainer } from "golden-layout";
import { createAccordionPanel, createPanelShell, renderEvidenceTimeline, type AuditSnapshot, type StudioInstance, type StudioPanelDefinition } from "@visutry/studio";
import { panels, accordionSections } from "./panel-catalog";

function createPanel(studio: Pick<StudioInstance, "collapsePanel" | "expandPanel">, container: ComponentContainer, id: string): void {
  const panel = panels[id] ?? panels.camera;
  const accordion = id === "leftDock" || id === "rightDock";
  const context = { panelId: id, getSnapshot: () => ({}) };
  if (accordion) {
    createAccordionPanel(context, container, accordionSections(id === "leftDock" ? ["camera", "diagnostics", "quality", "error"] : ["glb", "overlay", "pose", "metrics"]));
  } else {
    createPanelShell(context, container, { panelId: id, body: panel.body });
  }
  const item = container.element.closest<HTMLElement>(".lm_item");
  const controls = item?.querySelector<HTMLElement>(".lm_controls");
  if (!controls || controls.querySelector(".audit-collapse-control")) return;
  const toggle = document.createElement("button");
  toggle.className = "audit-collapse-control";
  toggle.type = "button";
  toggle.textContent = "▼";
  toggle.title = "Minimizar janela";
  toggle.setAttribute("aria-label", "Minimizar janela");
  controls.prepend(toggle);
  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    const collapsed = !item.classList.contains("studio-panel-collapsed");
    if (collapsed) studio.collapsePanel(id); else studio.expandPanel(id);
    toggle.textContent = collapsed ? "▲" : "▼";
    toggle.title = collapsed ? "Expandir janela" : "Minimizar janela";
    toggle.setAttribute("aria-label", toggle.title);
  });
}

export function createPanelDefinitions(studio: Pick<StudioInstance, "collapsePanel" | "expandPanel">): StudioPanelDefinition[] {
  return Object.keys(panels).map((id) => ({
    id,
    title: panels[id].title,
    region: id === "leftDock" ? "left" : id === "rightDock" ? "right" : id === "evidence" || id === "selected" ? "bottom" : "center",
    scrollable: id === "leftDock" || id === "rightDock",
    create: (_context, container) => createPanel(studio, container, id),
    update: id === "evidence" ? (element, snapshot: AuditSnapshot) => {
      const items = (snapshot.evidence ?? []) as { id: string; timestamp: number }[];
      if (items.length) element.querySelector(".timeline")!.innerHTML = renderEvidenceTimeline(items.map((item) => ({ label: new Date(item.timestamp).toLocaleTimeString(), best: item.id === snapshot.selectedFrameId })));
    } : id === "selected" ? (element, snapshot: AuditSnapshot) => {
      const selected = ((snapshot.evidence ?? []) as { id: string; timestamp: number }[]).find((item) => item.id === snapshot.selectedFrameId);
      if (selected) element.querySelector(".panel-body")!.innerHTML = `<div class="gl-row"><span>Time</span><strong>${new Date(selected.timestamp).toLocaleTimeString()}</strong></div><div class="gl-row"><span>Frame</span><strong>${selected.id}</strong></div>`;
    } : undefined,
  }));
}

/** Independent Audit Studio entrypoint. The legacy demo remains untouched. */
import "./main";
import { AuditStudioFace3D } from "./audit-studio-face3d";
import { createAuditHistory } from "./audit-studio-history";

// Keep the new entrypoint explicit: these helpers are the extension seams for
// future viewport providers and do not alter the legacy SDK bootstrap.
export const auditStudio = {
  face3d: AuditStudioFace3D,
  history: createAuditHistory,
};

function composeReferenceLayout(): void {
  const stage = document.getElementById("stage");
  const rightRail = document.getElementById("diagnostic-audit");
  const leftRail = document.getElementById("camera-audit");
  const viewportCard = document.querySelector<HTMLElement>(".audit-card--viewport");
  const objectiveCard = document.querySelector<HTMLElement>(".audit-card--objective");
  const snapshotStrip = document.getElementById("snapshot-strip");
  const bottomContent = document.getElementById("bottom-panel-content");
  if (!stage || !rightRail || !leftRail || !bottomContent) return;

  const bottomPanel = document.getElementById("bottom-panel");
  const panelToggle = document.getElementById("btn-panel-toggle");
  bottomPanel?.classList.remove("collapsed");
  panelToggle?.setAttribute("aria-expanded", "true");
  if (panelToggle) panelToggle.textContent = "Minimizar painel";

  // The existing controls keep their IDs and event handlers; only their visual
  // ownership changes to match the approved Audit Studio composition.
  if (viewportCard && viewportCard.parentElement !== stage) {
    stage.appendChild(viewportCard);
  }
  if (objectiveCard && objectiveCard.parentElement !== rightRail) {
    rightRail.insertBefore(objectiveCard, rightRail.children[1] ?? null);
  }
  if (snapshotStrip) {
    const evidence = document.createElement("section");
    evidence.className = "evidence-timeline";
    evidence.innerHTML = '<div class="timeline-heading"><strong>EVIDENCE TIMELINE</strong><span class="timeline-track"><i></i></span><small>até 8 capturas</small></div>';
    evidence.appendChild(snapshotStrip);
    const selected = document.createElement("div");
    selected.className = "selected-frame";
    selected.innerHTML = '<strong>SELECTED FRAME</strong><span id="selected-frame-time">—</span><p id="selected-frame-data">Selecione uma evidência para comparar com o estado atual.</p>';
    evidence.appendChild(selected);
    bottomContent.prepend(evidence);
    snapshotStrip.addEventListener("click", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>(".snapshot-item");
      if (!target) return;
      snapshotStrip.querySelectorAll(".snapshot-item").forEach((item) => item.classList.remove("selected"));
      target.classList.add("selected");
      const time = target.querySelector("figcaption")?.textContent?.split("\n")[0] ?? "—";
      const selectedTime = document.getElementById("selected-frame-time");
      const selectedData = document.getElementById("selected-frame-data");
      if (selectedTime) selectedTime.textContent = time;
      if (selectedData) selectedData.textContent = target.title || "Evidência selecionada";
    });
  }
}

composeReferenceLayout();

// The studio opens in the same observability posture as the approved concept:
// the operator sees the face mesh, readout and orthographic views immediately.
// Snapshots remain opt-in because they allocate image buffers over time.
window.setTimeout(() => {
  const enable = (id: string) => {
    const input = document.getElementById(id) as HTMLInputElement | null;
    if (!input || input.checked) return;
    input.checked = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };
  enable("toggle-diagnostic");
  enable("toggle-feature-overlay");
  enable("toggle-feature-readout");
  enable("toggle-feature-viewports");
}, 1600);

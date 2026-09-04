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

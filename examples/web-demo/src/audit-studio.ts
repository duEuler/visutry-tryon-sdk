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

import type { StudioLayoutConfig } from "./layout-contract.js";

/** Desktop baseline: side docks span the full height and evidence stays center-only. */
export function createDefaultStudioLayout(): StudioLayoutConfig {
  return { root: { type: "row", content: [
    { type: "component", width: 20, componentType: "leftDock", title: "Captura e diagnóstico" },
    { type: "column", width: 58, content: [
      { type: "row", height: 82, content: [
        { type: "component", componentType: "live", title: "Live 3D" },
        { type: "component", componentType: "viewports", title: "Viewports 3D", width: 28 },
      ] },
      { type: "row", height: 18, content: [
        { type: "component", componentType: "evidence", title: "Evidence timeline", width: 78 },
        { type: "component", componentType: "selected", title: "Selected frame", width: 22 },
      ] },
    ] },
    { type: "component", width: 22, componentType: "rightDock", title: "Auditoria espacial" },
  ] } };
}

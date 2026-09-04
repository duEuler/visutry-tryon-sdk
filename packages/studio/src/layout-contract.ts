import type { LayoutConfig } from "golden-layout";

export type StudioLayoutConfig = LayoutConfig;

type LayoutNode = Record<string, unknown>;

function finiteSize(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeNode(value: unknown): LayoutNode | null {
  if (!value || typeof value !== "object") return null;
  const node = value as LayoutNode;
  const type = node.type;
  if (type === "component") {
    if (typeof node.componentType !== "string" || !node.componentType.trim()) return null;
    const normalized: LayoutNode = { type: "component", componentType: node.componentType };
    if (typeof node.title === "string" && node.title.trim()) normalized.title = node.title;
    const width = finiteSize(node.width); if (width !== undefined) normalized.width = width;
    const height = finiteSize(node.height); if (height !== undefined) normalized.height = height;
    return normalized;
  }
  if (type !== "row" && type !== "column" && type !== "stack") return null;
  const content = Array.isArray(node.content) ? node.content.map(normalizeNode).filter((item): item is LayoutNode => item !== null) : [];
  if (!content.length) return null;
  const normalized: LayoutNode = { type, content };
  const width = finiteSize(node.width); if (width !== undefined) normalized.width = width;
  const height = finiteSize(node.height); if (height !== undefined) normalized.height = height;
  return normalized;
}

/** Strips Golden Layout's resolved/runtime-only fields before persistence. */
export function normalizeStudioLayout(layout: LayoutConfig): StudioLayoutConfig {
  const root = normalizeNode((layout as unknown as LayoutNode).root);
  if (!root) throw new Error("Invalid Studio layout root");
  return { root } as StudioLayoutConfig;
}

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

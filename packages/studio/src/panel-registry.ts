import type { ComponentContainer } from "golden-layout";
import type { AuditSnapshot, PanelId, StudioPanelContext, StudioPanelDefinition } from "./types.js";

export interface StudioPanelRegistry {
  register(definition: StudioPanelDefinition): void;
  unregister(id: PanelId): boolean;
  get(id: PanelId): StudioPanelDefinition | undefined;
  list(): StudioPanelDefinition[];
  create(id: PanelId, context: StudioPanelContext, container: ComponentContainer): void;
  update(id: PanelId, element: HTMLElement, snapshot: AuditSnapshot): void;
}

const regions = new Set(["left", "center", "right", "bottom"]);
function validateDefinition(definition: StudioPanelDefinition): void {
  if (!definition || typeof definition !== "object") throw new Error("Invalid Studio panel definition");
  if (!definition.id || typeof definition.id !== "string") throw new Error("Studio panel id is required");
  if (!definition.title || typeof definition.title !== "string") throw new Error(`Studio panel title is required: ${definition.id}`);
  if (!regions.has(definition.region)) throw new Error(`Invalid Studio panel region: ${definition.id}`);
  if (typeof definition.create !== "function") throw new Error(`Studio panel factory is required: ${definition.id}`);
}

export function createPanelRegistry(definitions: StudioPanelDefinition[] = []): StudioPanelRegistry {
  const entries = new Map<PanelId, StudioPanelDefinition>();
  definitions.forEach((definition) => {
    validateDefinition(definition);
    if (entries.has(definition.id)) throw new Error(`Duplicate Studio panel id: ${definition.id}`);
    entries.set(definition.id, definition);
  });
  return {
    register(definition) {
      validateDefinition(definition);
      if (entries.has(definition.id)) throw new Error(`Duplicate Studio panel id: ${definition.id}`);
      entries.set(definition.id, definition);
    },
    unregister(id) { return entries.delete(id); },
    get(id) { return entries.get(id); },
    list() { return [...entries.values()]; },
    create(id, context, container) { entries.get(id)?.create(context, container); },
    update(id, element, snapshot) { entries.get(id)?.update?.(element, snapshot); },
  };
}

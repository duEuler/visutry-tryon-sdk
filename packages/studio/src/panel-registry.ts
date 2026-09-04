import type { ComponentContainer } from "golden-layout";
import type { AuditSnapshot, PanelId, StudioPanelContext, StudioPanelDefinition } from "./types.js";

export interface StudioPanelRegistry {
  register(definition: StudioPanelDefinition): void;
  get(id: PanelId): StudioPanelDefinition | undefined;
  list(): StudioPanelDefinition[];
  create(id: PanelId, context: StudioPanelContext, container: ComponentContainer): void;
  update(id: PanelId, element: HTMLElement, snapshot: AuditSnapshot): void;
}

export function createPanelRegistry(definitions: StudioPanelDefinition[] = []): StudioPanelRegistry {
  const entries = new Map<PanelId, StudioPanelDefinition>();
  definitions.forEach((definition) => entries.set(definition.id, definition));
  return {
    register(definition) { entries.set(definition.id, definition); },
    get(id) { return entries.get(id); },
    list() { return [...entries.values()]; },
    create(id, context, container) { entries.get(id)?.create(context, container); },
    update(id, element, snapshot) { entries.get(id)?.update?.(element, snapshot); },
  };
}

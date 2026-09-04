import type { LayoutConfig, ComponentContainer } from "golden-layout";

export type PanelId = string;
export type StudioRegion = "left" | "center" | "right" | "bottom";

export interface AuditSnapshot { [key: string]: unknown }

export interface StudioPanelContext {
  panelId: PanelId;
  getSnapshot(): AuditSnapshot;
}

export interface StudioPanelDefinition {
  id: PanelId;
  title: string;
  region: StudioRegion;
  scrollable: boolean;
  create(context: StudioPanelContext, container: ComponentContainer): void;
  update?(element: HTMLElement, snapshot: AuditSnapshot): void;
  destroy?(element: HTMLElement): void;
}

export interface LayoutPersistence {
  load(): LayoutConfig | null;
  save(layout: LayoutConfig): void;
  clear(): void;
}

export interface ToolbarOptions { enabled?: boolean }

export interface StudioOptions {
  host: HTMLElement;
  panels: StudioPanelDefinition[];
  initialLayout: LayoutConfig;
  persistence?: LayoutPersistence;
  snapshot?: AuditSnapshot;
  toolbar?: ToolbarOptions;
}

export interface StudioInstance {
  mount(): void;
  saveLayout(): void;
  restoreDefaultLayout(): void;
  getLayout(): LayoutConfig;
  setLayout(layout: LayoutConfig): void;
  showPanel(id: PanelId): void;
  hidePanel(id: PanelId): void;
  collapsePanel(id: PanelId): void;
  expandPanel(id: PanelId): void;
  destroy(): void;
}

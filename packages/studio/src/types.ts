import type { LayoutConfig, ComponentContainer } from "golden-layout";

export type PanelId = string;
export type StudioRegion = "left" | "center" | "right" | "bottom";

export interface AuditSnapshot { [key: string]: unknown }
export type StudioMode = "static" | "connected" | "degraded";

export interface StudioRuntimeAdapter {
  getSnapshot(): AuditSnapshot;
  subscribe(listener: (snapshot: AuditSnapshot) => void): () => void;
  initialize?(): Promise<void>;
  dispose?(): void;
}

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
  loadState?(): PersistedStudioState | null;
  saveState?(state: PersistedStudioState): void;
}

export interface PersistedStudioState {
  version: number;
  layout: LayoutConfig;
  hiddenPanels: PanelId[];
  collapsedPanels: PanelId[];
}

export interface ToolbarOptions { enabled?: boolean }

export interface StudioOptions {
  host: HTMLElement;
  panels: StudioPanelDefinition[];
  initialLayout: LayoutConfig;
  persistence?: LayoutPersistence;
  snapshot?: AuditSnapshot;
  toolbar?: ToolbarOptions;
  runtime?: StudioRuntimeAdapter;
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
  getMode(): StudioMode;
  connectRuntime(runtime: StudioRuntimeAdapter): Promise<void>;
}

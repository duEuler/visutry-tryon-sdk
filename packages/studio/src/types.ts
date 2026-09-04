import type { LayoutConfig, ComponentContainer } from "golden-layout";

export type PanelId = string;
export type StudioRegion = "left" | "center" | "right" | "bottom";

export interface CameraState { active?: boolean; width?: number; height?: number; fps?: number; source?: string; }
export interface TrackingState { detected?: boolean; confidence?: number; landmarks?: number; stability?: number; latencyMs?: number; }
export interface FacePose { yaw?: number; pitch?: number; roll?: number; position?: { x: number; y: number; z: number }; }
export interface GlassesAssetManifest { id?: string; name?: string; modelUrl?: string; }
export interface RenderMetrics { drawCalls?: number; triangles?: number; frameTimeMs?: number; dpr?: number; width?: number; height?: number; }
export interface EvidenceFrame { id: string; timestamp: number; dataUrl?: string; rmsError?: number; confidence?: number; }
export interface AuditSnapshot {
  mode?: StudioMode;
  camera?: CameraState;
  tracking?: TrackingState;
  pose?: FacePose | null;
  glb?: GlassesAssetManifest | null;
  render?: RenderMetrics;
  evidence?: EvidenceFrame[];
  selectedFrameId?: string | null;
  [key: string]: unknown;
}
export type StudioMode = "static" | "connected" | "degraded";

export interface StudioRuntimeAdapter {
  getSnapshot(): AuditSnapshot;
  subscribe(listener: (snapshot: AuditSnapshot) => void): () => void;
  /** Optional publisher used by deterministic/static adapters and test hosts. */
  setSnapshot?(snapshot: AuditSnapshot): void;
  captureEvidence?(): Promise<EvidenceFrame>;
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
  setLayoutLocked(locked: boolean): void;
  isLayoutLocked(): boolean;
  destroy(): void;
  getMode(): StudioMode;
  subscribeMode(listener: (mode: StudioMode) => void): () => void;
  connectRuntime(runtime: StudioRuntimeAdapter): Promise<void>;
}

import type { AuditSnapshot, EvidenceFrame, StudioRuntimeAdapter } from "./types.js";

/** Shared lifecycle contract for optional Studio integrations. */
export interface StudioLifecycleAdapter {
  initialize?(): Promise<void>;
  dispose?(): void;
}

export interface CameraAdapter extends StudioLifecycleAdapter {
  start?(): Promise<void>;
  stop?(): void;
  getVideo?(): HTMLVideoElement | null;
}

export interface TrackingAdapter extends StudioLifecycleAdapter {
  start?(): Promise<void>;
  stop?(): void;
  getSnapshot?(): AuditSnapshot;
}

export interface RendererAdapter extends StudioLifecycleAdapter {
  resize?(): void;
  pause?(): void;
  resume?(): void;
}

export interface GlbAdapter extends StudioLifecycleAdapter {
  load?(manifest: unknown): Promise<void>;
  unload?(): void;
}

export interface EvidenceAdapter extends StudioLifecycleAdapter {
  capture?(): Promise<EvidenceFrame>;
}

/** Composite boundary used by hosts that expose individual adapters. */
export interface StudioAdapters {
  camera?: CameraAdapter;
  tracking?: TrackingAdapter;
  renderer?: RendererAdapter;
  glb?: GlbAdapter;
  evidence?: EvidenceAdapter;
  runtime?: StudioRuntimeAdapter;
}

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

/** Composes independent adapters behind the runtime contract used by Studio. */
export function createCompositeStudioRuntime(adapters: StudioAdapters, initial: AuditSnapshot = {}): StudioRuntimeAdapter {
  let snapshot: AuditSnapshot = { mode: "connected", ...initial };
  let disposed = false;
  let initialized = false;
  const listeners = new Set<(next: AuditSnapshot) => void>();
  const publish = (next: AuditSnapshot) => {
    if (disposed) return;
    snapshot = { ...snapshot, ...next };
    listeners.forEach((listener) => listener(snapshot));
  };
  const lifecycle = [adapters.camera, adapters.tracking, adapters.renderer, adapters.glb, adapters.evidence].filter(Boolean) as StudioLifecycleAdapter[];
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) { if (disposed) return () => undefined; listeners.add(listener); return () => listeners.delete(listener); },
    async initialize() {
      if (disposed || initialized) return;
      const started: StudioLifecycleAdapter[] = [];
      try {
        for (const adapter of lifecycle) {
          await adapter.initialize?.();
          started.push(adapter);
        }
        initialized = true;
      } catch (error) {
        publish({ mode: "degraded", error });
        [...started].reverse().forEach((adapter) => adapter.dispose?.());
        throw error;
      }
      const tracking = adapters.tracking?.getSnapshot?.();
      if (tracking) publish(tracking);
    },
    async captureEvidence() {
      if (disposed || !adapters.evidence?.capture) throw new Error("Evidence adapter unavailable");
      const frame = await adapters.evidence.capture();
      publish({ evidence: [...(snapshot.evidence ?? []), frame], selectedFrameId: frame.id });
      return frame;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      [...lifecycle].reverse().forEach((adapter) => adapter.dispose?.());
      listeners.clear();
    },
  };
}

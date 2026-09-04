import type { AuditSnapshot, StudioRuntimeAdapter } from "./types.js";
import type { CameraAdapter } from "./adapters/camera-adapter.js";
import type { TrackingAdapter } from "./adapters/tracking-adapter.js";
import type { RendererAdapter } from "./adapters/renderer-adapter.js";
import type { GlbAdapter } from "./adapters/glb-adapter.js";
import type { EvidenceAdapter } from "./adapters/evidence-adapter.js";

export type { CameraAdapter } from "./adapters/camera-adapter.js";
export type { TrackingAdapter } from "./adapters/tracking-adapter.js";
export type { RendererAdapter } from "./adapters/renderer-adapter.js";
export type { GlbAdapter } from "./adapters/glb-adapter.js";
export type { EvidenceAdapter } from "./adapters/evidence-adapter.js";

/** Shared lifecycle contract for optional Studio integrations. */
export interface StudioLifecycleAdapter {
  initialize?(): Promise<void>;
  dispose?(): void;
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
          started.push(adapter);
          await adapter.initialize?.();
        }
        initialized = true;
        publish({ mode: "connected", error: undefined });
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

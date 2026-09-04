import { normalizeAuditSnapshot } from "@visutry/studio/audit-snapshot";
import type { StudioRuntimeAdapter, AuditSnapshot, EvidenceFrame } from "@visutry/studio";
import type { VisuTrySDK, VisuTrySDKEvents } from "@visutry/tryon-core";

export interface StudioRuntimeAdapterOptions {
  /** Optional live video source used to compose camera + renderer evidence. */
  getVideo?: () => HTMLVideoElement | null;
}

async function composeEvidence(dataUrl: string, video: HTMLVideoElement | null): Promise<string> {
  if (!video || video.readyState < 2) return dataUrl;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || video.clientWidth;
  canvas.height = video.videoHeight || video.clientHeight;
  if (!canvas.width || !canvas.height) return dataUrl;
  const context = canvas.getContext("2d");
  if (!context) return dataUrl;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const overlay = new Image();
  overlay.src = dataUrl;
  try { await overlay.decode(); } catch { return dataUrl; }
  context.drawImage(overlay, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

/** Adapts the public web SDK event stream to the Studio runtime contract. */
export function createStudioRuntimeAdapter(sdk: VisuTrySDK, options: StudioRuntimeAdapterOptions = {}): StudioRuntimeAdapter {
  const listeners = new Set<(snapshot: AuditSnapshot) => void>();
  let snapshot: AuditSnapshot = normalizeAuditSnapshot({ mode: "connected", camera: { active: false }, tracking: { detected: false } });
  let initialized = false;
  let disposed = false;
  const publish = (patch: AuditSnapshot) => {
    snapshot = normalizeAuditSnapshot(patch, snapshot);
    listeners.forEach((listener) => listener(snapshot));
  };
  const handlers: { [K in keyof VisuTrySDKEvents]: VisuTrySDKEvents[K] } = {
    ready: () => publish({ mode: "connected" }),
    faceDetected: (face) => publish({ face, tracking: { detected: true, confidence: face.quality.confidence } }),
    faceLost: () => publish({ tracking: { detected: false } }),
    poseUpdated: (pose) => publish({ pose }),
    glassesLoaded: (asset) => publish({ glb: asset }),
    glassesLoadFailed: (error) => publish({ mode: "degraded", error }),
    faceShapeAnalyzed: (result) => publish({ faceShape: result }),
    performanceUpdated: (stats) => publish({
      performance: stats,
      render: { frameTimeMs: stats.renderLatencyMs },
      tracking: { latencyMs: stats.detectLatencyMs },
    }),
    error: (error) => publish({ mode: "degraded", error }),
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async captureEvidence(): Promise<EvidenceFrame> {
      try {
        const result = await sdk.snapshot({ format: "image/png", mirror: true });
        const dataUrl = await composeEvidence(result.dataUrl, options.getVideo?.() ?? null);
        const tracking = snapshot.tracking as { confidence?: number } | undefined;
        const diagnostics = snapshot.face as { rmsError?: number } | undefined;
        const frame: EvidenceFrame = {
          id: `evidence-${result.timestamp}`,
          timestamp: result.timestamp,
          dataUrl,
          confidence: tracking?.confidence,
          rmsError: diagnostics?.rmsError,
        };
        const evidence = [...((snapshot.evidence as EvidenceFrame[] | undefined) ?? []), frame];
        publish({ evidence, selectedFrameId: frame.id });
        return frame;
      } catch (error) {
        publish({ mode: "degraded", error });
        throw error;
      }
    },
    async initialize() {
      if (initialized || disposed) return;
      initialized = true;
      (Object.keys(handlers) as (keyof VisuTrySDKEvents)[]).forEach((eventName) => sdk.on(eventName, handlers[eventName]));
      try { await sdk.initialize(); } catch (error) { initialized = false; publish({ mode: "degraded", error }); throw error; }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      (Object.keys(handlers) as (keyof VisuTrySDKEvents)[]).forEach((eventName) => sdk.off(eventName, handlers[eventName]));
      listeners.clear();
      sdk.destroy();
    },
  };
}

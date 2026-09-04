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
  await overlay.decode();
  context.drawImage(overlay, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

/** Adapts the public web SDK event stream to the Studio runtime contract. */
export function createStudioRuntimeAdapter(sdk: VisuTrySDK, options: StudioRuntimeAdapterOptions = {}): StudioRuntimeAdapter {
  const listeners = new Set<(snapshot: AuditSnapshot) => void>();
  let snapshot: AuditSnapshot = { mode: "connected", camera: { active: false }, tracking: { detected: false } };
  const publish = (patch: AuditSnapshot) => {
    snapshot = { ...snapshot, ...patch };
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
    performanceUpdated: (stats) => publish({ performance: stats }),
    error: (error) => publish({ mode: "degraded", error }),
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async captureEvidence(): Promise<EvidenceFrame> {
      const result = await sdk.snapshot({ format: "image/png", mirror: true });
      const dataUrl = await composeEvidence(result.dataUrl, options.getVideo?.() ?? null);
      const frame: EvidenceFrame = { id: `evidence-${result.timestamp}`, timestamp: result.timestamp, dataUrl };
      const evidence = [...((snapshot.evidence as EvidenceFrame[] | undefined) ?? []), frame];
      publish({ evidence, selectedFrameId: frame.id });
      return frame;
    },
    async initialize() {
      (Object.keys(handlers) as (keyof VisuTrySDKEvents)[]).forEach((eventName) => sdk.on(eventName, handlers[eventName]));
      try { await sdk.initialize(); } catch (error) { publish({ mode: "degraded", error }); throw error; }
    },
    dispose() {
      (Object.keys(handlers) as (keyof VisuTrySDKEvents)[]).forEach((eventName) => sdk.off(eventName, handlers[eventName]));
      listeners.clear();
      sdk.destroy();
    },
  };
}

import type { StudioRuntimeAdapter, AuditSnapshot, EvidenceFrame } from "@visutry/studio";
import type { VisuTrySDK, VisuTrySDKEvents } from "@visutry/tryon-core";

/** Adapts the public web SDK event stream to the Studio runtime contract. */
export function createStudioRuntimeAdapter(sdk: VisuTrySDK): StudioRuntimeAdapter {
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
      const frame: EvidenceFrame = { id: `evidence-${result.timestamp}`, timestamp: result.timestamp, dataUrl: result.dataUrl };
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

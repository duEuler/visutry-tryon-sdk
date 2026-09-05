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
  const asNumber = (value: unknown): number | undefined => typeof value === "number" && Number.isFinite(value) ? value : undefined;
  const distance = (a: unknown, b: unknown): number | undefined => {
    if (!a || !b || typeof a !== "object" || typeof b !== "object") return undefined;
    const first = a as { x?: unknown; y?: unknown; z?: unknown };
    const second = b as { x?: unknown; y?: unknown; z?: unknown };
    const x1 = asNumber(first.x); const y1 = asNumber(first.y); const z1 = asNumber(first.z);
    const x2 = asNumber(second.x); const y2 = asNumber(second.y); const z2 = asNumber(second.z);
    if ([x1, y1, z1, x2, y2, z2].some((value) => value === undefined)) return undefined;
    return Math.sqrt((x2! - x1!) ** 2 + (y2! - y1!) ** 2 + (z2! - z1!) ** 2);
  };
  const normalizePose = (value: unknown) => {
    if (!value || typeof value !== "object") return null;
    const pose = value as { yaw?: unknown; pitch?: unknown; roll?: unknown; position?: unknown; rotation?: unknown; scale?: unknown; visible?: unknown; reason?: unknown };
    const rotation = pose.rotation as { x?: unknown; y?: unknown; z?: unknown } | undefined;
    const scale = pose.scale as { x?: unknown; y?: unknown; z?: unknown } | undefined;
    const position = pose.position as { x?: unknown; y?: unknown; z?: unknown } | undefined;
    return {
      yaw: asNumber(pose.yaw) ?? asNumber(rotation?.y),
      pitch: asNumber(pose.pitch) ?? asNumber(rotation?.x),
      roll: asNumber(pose.roll) ?? asNumber(rotation?.z),
      position: position && asNumber(position.x) !== undefined && asNumber(position.y) !== undefined && asNumber(position.z) !== undefined
        ? { x: asNumber(position.x)!, y: asNumber(position.y)!, z: asNumber(position.z)! }
        : undefined,
      rotation: rotation && asNumber(rotation.x) !== undefined && asNumber(rotation.y) !== undefined && asNumber(rotation.z) !== undefined
        ? { x: asNumber(rotation.x)!, y: asNumber(rotation.y)!, z: asNumber(rotation.z)! }
        : undefined,
      scale: scale && asNumber(scale.x) !== undefined && asNumber(scale.y) !== undefined && asNumber(scale.z) !== undefined
        ? { x: asNumber(scale.x)!, y: asNumber(scale.y)!, z: asNumber(scale.z)! }
        : undefined,
      visible: typeof pose.visible === "boolean" ? pose.visible : undefined,
      reason: typeof pose.reason === "string" ? pose.reason : undefined,
    };
  };
  const publish = (patch: AuditSnapshot) => {
    if (disposed) return;
    snapshot = normalizeAuditSnapshot(patch, snapshot);
    listeners.forEach((listener) => listener(snapshot));
  };
  const handlers: { [K in keyof VisuTrySDKEvents]: VisuTrySDKEvents[K] } = {
    ready: () => publish({ mode: "connected" }),
    faceDetected: (face) => {
      const semantic = face.landmarks?.semantic;
      const eyeDistance = distance(semantic?.leftEyeCenter, semantic?.rightEyeCenter);
      const cameraWidth = snapshot.camera?.width ?? 640;
      const explicitRms = asNumber((face as unknown as { rmsError?: unknown }).rmsError);
      const confidence = asNumber(face.quality?.confidence) ?? 0;
      const stability = asNumber(face.quality?.stabilityScore) ?? 0;
      const rmsError = explicitRms ?? Math.max(0.01, (1 - confidence) * 1.5 + (1 - stability) * 0.5);
      publish({
        face: {
          ...face,
          rmsError,
          rmsErrorEstimated: explicitRms === undefined,
          interpupilar: eyeDistance === undefined ? undefined : Math.round(eyeDistance * cameraWidth * 1000) / 1000,
        },
        tracking: {
          detected: true,
          confidence: face.quality.confidence,
          stability: face.quality.stabilityScore,
          landmarks: face.landmarks?.raw?.length,
        },
      });
    },
    faceLost: () => publish({ tracking: { detected: false } }),
    poseUpdated: (pose) => publish({ pose: normalizePose(pose) }),
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
  const detachHandlers = () => {
    (Object.keys(handlers) as (keyof VisuTrySDKEvents)[]).forEach((eventName) => sdk.off(eventName, handlers[eventName]));
  };
  return {
    getSnapshot: () => snapshot,
    setSnapshot(patch) {
      publish(patch);
    },
    subscribe(listener) {
      if (disposed) return () => false;
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async captureEvidence(): Promise<EvidenceFrame> {
      if (disposed) throw new Error("Studio runtime adapter disposed");
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
      try { await sdk.initialize(); } catch (error) {
        initialized = false;
        detachHandlers();
        publish({ mode: "degraded", error });
        throw error;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      detachHandlers();
      listeners.clear();
      sdk.destroy();
    },
  };
}

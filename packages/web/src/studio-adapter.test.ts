import { describe, expect, it, vi } from "vitest";
import { createStudioRuntimeAdapter } from "./studio-adapter.js";

function createSdkMock() {
  const handlers = new Map<string, (...args: any[]) => void>();
  return {
    handlers,
    on: vi.fn((name: string, handler: (...args: any[]) => void) => handlers.set(name, handler)),
    off: vi.fn((name: string) => handlers.delete(name)),
    initialize: vi.fn(async () => undefined),
    destroy: vi.fn(),
    snapshot: vi.fn(async () => ({ timestamp: 1234, dataUrl: "data:image/png;base64,abc" })),
  };
}

describe("createStudioRuntimeAdapter", () => {
  it("maps SDK events into the Studio snapshot contract", async () => {
    const sdk = createSdkMock();
    const adapter = createStudioRuntimeAdapter(sdk as never);
    await adapter.initialize?.();
    sdk.handlers.get("faceDetected")?.({ quality: { confidence: 0.91 } });
    sdk.handlers.get("poseUpdated")?.({ yaw: 2 });
    expect(adapter.getSnapshot()).toMatchObject({ tracking: { detected: true, confidence: 0.91 }, pose: { yaw: 2 } });
  });

  it("normalizes SDK pose rotation and face geometry for Studio panels", async () => {
    const sdk = createSdkMock();
    const adapter = createStudioRuntimeAdapter(sdk as never);
    await adapter.initialize?.();
    sdk.handlers.get("faceDetected")?.({
      quality: { confidence: 0.9, stabilityScore: 0.88 },
      landmarks: { raw: new Array(478), semantic: { leftEyeCenter: { x: 0.4, y: 0.4, z: 0 }, rightEyeCenter: { x: 0.5, y: 0.4, z: 0 } } },
      bbox: { width: 0.2, height: 0.3 },
    });
    sdk.handlers.get("poseUpdated")?.({ rotation: { x: 1, y: 2, z: 3 }, position: { x: 4, y: 5, z: 6 } });
    expect(adapter.getSnapshot()).toMatchObject({ tracking: { landmarks: 478, stability: 0.88 }, face: { interpupilar: 64 }, pose: { yaw: 2, pitch: 1, roll: 3, position: { x: 4, y: 5, z: 6 } } });
  });

  it("forwards the loaded GLB manifest to the Studio snapshot", async () => {
    const sdk = createSdkMock();
    const adapter = createStudioRuntimeAdapter(sdk as never);
    await adapter.initialize?.();
    const manifest = { id: "aviator", name: "Classic Aviator", modelUrl: "/aviator.glb" };
    sdk.handlers.get("glassesLoaded")?.(manifest);
    expect(adapter.getSnapshot().glb).toEqual(manifest);
  });

  it("normalizes performance metrics for Studio panels", async () => {
    const sdk = createSdkMock();
    const adapter = createStudioRuntimeAdapter(sdk as never);
    await adapter.initialize?.();
    sdk.handlers.get("performanceUpdated")?.({ fps: 30, detectLatencyMs: 12, renderLatencyMs: 4 });
    expect(adapter.getSnapshot()).toMatchObject({ tracking: { latencyMs: 12 }, render: { frameTimeMs: 4 } });
  });

  it("publishes camera state supplied by the host after the stream starts", () => {
    const sdk = createSdkMock();
    const adapter = createStudioRuntimeAdapter(sdk as never);
    adapter.setSnapshot?.({ camera: { active: true, source: "Integrated Webcam", width: 640, height: 480, fps: 30 } });
    expect(adapter.getSnapshot()).toMatchObject({ camera: { active: true, source: "Integrated Webcam", width: 640, height: 480, fps: 30 } });
  });

  it("preserves nested snapshot blocks across SDK events", async () => {
    const sdk = createSdkMock();
    const adapter = createStudioRuntimeAdapter(sdk as never);
    await adapter.initialize?.();
    sdk.handlers.get("performanceUpdated")?.({ detectLatencyMs: 12, renderLatencyMs: 4 });
    sdk.handlers.get("poseUpdated")?.({ yaw: 2 });
    expect(adapter.getSnapshot()).toMatchObject({ tracking: { latencyMs: 12 }, render: { frameTimeMs: 4 }, pose: { yaw: 2 } });
  });

  it("records captured evidence and selects the new frame", async () => {
    const sdk = createSdkMock();
    const adapter = createStudioRuntimeAdapter(sdk as never);
    const frame = await adapter.captureEvidence?.();
    expect(frame).toMatchObject({ id: "evidence-1234", timestamp: 1234, dataUrl: "data:image/png;base64,abc" });
    expect(adapter.getSnapshot()).toMatchObject({ selectedFrameId: "evidence-1234", evidence: [frame] });
  });

  it("copies available diagnostics into the captured evidence frame", async () => {
    const sdk = createSdkMock();
    const adapter = createStudioRuntimeAdapter(sdk as never);
    await adapter.initialize?.();
    sdk.handlers.get("faceDetected")?.({ quality: { confidence: 0.95 }, rmsError: 0.679 });
    const frame = await adapter.captureEvidence?.();
    expect(frame).toMatchObject({ confidence: 0.95, rmsError: 0.679 });
  });

  it("composes a ready video frame underneath the SDK overlay", async () => {
    const sdk = createSdkMock();
    const video = document.createElement("video");
    Object.defineProperty(video, "readyState", { configurable: true, value: 4 });
    Object.defineProperty(video, "videoWidth", { configurable: true, value: 640 });
    Object.defineProperty(video, "videoHeight", { configurable: true, value: 480 });
    const drawImage = vi.fn();
    const toDataURL = vi.fn(() => "data:image/png;base64,composite");
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage } as never);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(toDataURL);
    Object.defineProperty(Image.prototype, "decode", { configurable: true, value: vi.fn(async () => undefined) });

    const adapter = createStudioRuntimeAdapter(sdk as never, { getVideo: () => video });
    const frame = await adapter.captureEvidence?.();

    expect(drawImage).toHaveBeenCalledTimes(2);
    expect(toDataURL).toHaveBeenCalledWith("image/png");
    expect(frame?.dataUrl).toBe("data:image/png;base64,composite");
  });

  it("publishes degraded mode when evidence capture fails", async () => {
    const sdk = createSdkMock();
    sdk.snapshot.mockRejectedValueOnce(new Error("snapshot denied"));
    const adapter = createStudioRuntimeAdapter(sdk as never);
    await expect(adapter.captureEvidence?.()).rejects.toThrow("snapshot denied");
    expect(adapter.getSnapshot()).toMatchObject({ mode: "degraded", error: expect.any(Error) });
  });

  it("switches to degraded mode on runtime and asset errors", async () => {
    const sdk = createSdkMock();
    const adapter = createStudioRuntimeAdapter(sdk as never);
    await adapter.initialize?.();
    sdk.handlers.get("glassesLoadFailed")?.({ code: "MODEL_LOAD_FAILED", message: "model unavailable" });
    expect(adapter.getSnapshot()).toMatchObject({ mode: "degraded", error: { code: "MODEL_LOAD_FAILED" } });
    sdk.handlers.get("ready")?.();
    expect(adapter.getSnapshot().mode).toBe("connected");
  });

  it("unsubscribes SDK events and destroys the SDK", async () => {
    const sdk = createSdkMock();
    const adapter = createStudioRuntimeAdapter(sdk as never);
    await adapter.initialize?.();
    adapter.dispose?.();
    expect(sdk.off).toHaveBeenCalledTimes(9);
    expect(sdk.destroy).toHaveBeenCalledOnce();
  });

  it("rejects evidence capture after disposal without touching the SDK", async () => {
    const sdk = createSdkMock();
    const adapter = createStudioRuntimeAdapter(sdk as never);
    adapter.dispose?.();
    await expect(adapter.captureEvidence?.()).rejects.toThrow("disposed");
    expect(sdk.snapshot).not.toHaveBeenCalled();
  });

  it("does not retain subscriptions created after disposal", () => {
    const sdk = createSdkMock();
    const adapter = createStudioRuntimeAdapter(sdk as never);
    adapter.dispose?.();
    const listener = vi.fn();
    const unsubscribe = adapter.subscribe(listener);
    sdk.handlers.get("ready")?.();
    unsubscribe();
    expect(listener).not.toHaveBeenCalled();
  });

  it("initializes event handlers only once", async () => {
    const sdk = createSdkMock();
    const adapter = createStudioRuntimeAdapter(sdk as never);
    await adapter.initialize?.();
    await adapter.initialize?.();
    expect(sdk.on).toHaveBeenCalledTimes(9);
    adapter.dispose?.();
    adapter.dispose?.();
    expect(sdk.destroy).toHaveBeenCalledOnce();
  });

  it("detaches handlers after initialization failure so retry is clean", async () => {
    const sdk = createSdkMock();
    sdk.initialize.mockRejectedValueOnce(new Error("init failed")).mockResolvedValueOnce(undefined);
    const adapter = createStudioRuntimeAdapter(sdk as never);
    await expect(adapter.initialize?.()).rejects.toThrow("init failed");
    expect(sdk.off).toHaveBeenCalledTimes(9);
    await adapter.initialize?.();
    expect(sdk.on).toHaveBeenCalledTimes(18);
    adapter.dispose?.();
  });
});

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

  it("records captured evidence and selects the new frame", async () => {
    const sdk = createSdkMock();
    const adapter = createStudioRuntimeAdapter(sdk as never);
    const frame = await adapter.captureEvidence?.();
    expect(frame).toMatchObject({ id: "evidence-1234", timestamp: 1234, dataUrl: "data:image/png;base64,abc" });
    expect(adapter.getSnapshot()).toMatchObject({ selectedFrameId: "evidence-1234", evidence: [frame] });
  });

  it("unsubscribes SDK events and destroys the SDK", async () => {
    const sdk = createSdkMock();
    const adapter = createStudioRuntimeAdapter(sdk as never);
    await adapter.initialize?.();
    adapter.dispose?.();
    expect(sdk.off).toHaveBeenCalledTimes(9);
    expect(sdk.destroy).toHaveBeenCalledOnce();
  });
});

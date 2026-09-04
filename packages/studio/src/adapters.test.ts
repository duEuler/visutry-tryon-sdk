import { describe, expect, it } from "vitest";
import { createCompositeStudioRuntime, type StudioAdapters } from "./adapters.js";

describe("Studio adapter contracts", () => {
  it("allows independent optional adapters without requiring a runtime", () => {
    const adapters: StudioAdapters = {
      camera: { start: async () => undefined, stop: () => undefined },
      renderer: { pause: () => undefined, resume: () => undefined },
    };
    expect(adapters.runtime).toBeUndefined();
    expect(adapters.camera?.start).toBeTypeOf("function");
    expect(adapters.renderer?.pause).toBeTypeOf("function");
  });

  it("composes lifecycle and evidence adapters in deterministic order", async () => {
    const calls: string[] = [];
    const runtime = createCompositeStudioRuntime({
      camera: { initialize: async () => { calls.push("camera+"); }, dispose: () => calls.push("camera-") },
      renderer: { initialize: async () => { calls.push("renderer+"); }, dispose: () => calls.push("renderer-") },
      evidence: { capture: async () => ({ id: "frame-1", timestamp: 1 }), dispose: () => calls.push("evidence-") },
    });
    await runtime.initialize?.();
    const frame = await runtime.captureEvidence?.();
    runtime.dispose?.();
    expect(frame?.id).toBe("frame-1");
    expect(runtime.getSnapshot()).toMatchObject({ selectedFrameId: "frame-1", evidence: [frame] });
    expect(calls).toEqual(["camera+", "renderer+", "evidence-", "renderer-", "camera-"]);
  });

  it("does not capture after disposal", async () => {
    const runtime = createCompositeStudioRuntime({ evidence: { capture: async () => ({ id: "frame", timestamp: 1 }) } });
    runtime.dispose?.();
    await expect(runtime.captureEvidence?.()).rejects.toThrow("Evidence adapter unavailable");
  });
});

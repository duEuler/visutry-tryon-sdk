import { describe, expect, it } from "vitest";
import { createCompositeStudioRuntime, type StudioAdapters } from "./adapters.js";
import type { CameraAdapter } from "./adapters/camera-adapter.js";
import type { EvidenceAdapter } from "./adapters/evidence-adapter.js";
import type { GlbAdapter } from "./adapters/glb-adapter.js";
import type { RendererAdapter } from "./adapters/renderer-adapter.js";
import type { TrackingAdapter } from "./adapters/tracking-adapter.js";

describe("Studio adapter contracts", () => {
  it("keeps each adapter boundary independently importable", () => {
    const adapters: [CameraAdapter, TrackingAdapter, RendererAdapter, GlbAdapter, EvidenceAdapter] = [
      {}, {}, {}, {}, {},
    ];
    expect(adapters).toHaveLength(5);
  });

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

  it("enters degraded mode and rolls back started adapters on initialization failure", async () => {
    const calls: string[] = [];
    const runtime = createCompositeStudioRuntime({
      camera: { initialize: async () => { calls.push("camera+"); }, dispose: () => { calls.push("camera-"); } },
      renderer: { initialize: async () => { calls.push("renderer+"); throw new Error("renderer unavailable"); }, dispose: () => calls.push("renderer-") },
    });
    await expect(runtime.initialize?.()).rejects.toThrow("renderer unavailable");
    expect(runtime.getSnapshot()).toMatchObject({ mode: "degraded", error: expect.any(Error) });
    expect(calls).toEqual(["camera+", "renderer+", "renderer-", "camera-"]);
  });

  it("recovers the connected mode on a later successful initialization", async () => {
    let attempts = 0;
    const runtime = createCompositeStudioRuntime({
      renderer: {
        initialize: async () => { attempts += 1; if (attempts === 1) throw new Error("temporary"); },
      },
    });
    await expect(runtime.initialize?.()).rejects.toThrow("temporary");
    expect(runtime.getSnapshot().mode).toBe("degraded");
    await runtime.initialize?.();
    expect(runtime.getSnapshot().mode).toBe("connected");
    expect(runtime.getSnapshot().error).toBeUndefined();
  });
});

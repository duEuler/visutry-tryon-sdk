import { describe, expect, it } from "vitest";
import type { StudioAdapters } from "./adapters.js";

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
});

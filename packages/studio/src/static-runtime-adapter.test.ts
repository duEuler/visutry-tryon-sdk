import { describe, expect, it } from "vitest";
import { createStaticRuntimeAdapter } from "./static-runtime-adapter.js";

describe("createStaticRuntimeAdapter", () => {
  it("provides a deterministic static mode and publishes updates", () => {
    const adapter = createStaticRuntimeAdapter({ camera: { active: false } });
    const snapshots: unknown[] = [];
    adapter.subscribe((snapshot) => snapshots.push(snapshot));
    adapter.setSnapshot?.({ tracking: { detected: true } });
    expect(adapter.getSnapshot()).toMatchObject({ mode: "static", camera: { active: false }, tracking: { detected: true } });
    expect(snapshots).toHaveLength(1);
  });
});

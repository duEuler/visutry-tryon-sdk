import { describe, expect, it, vi } from "vitest";
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

  it("keeps static mode even when the supplied snapshot has another mode", () => {
    const adapter = createStaticRuntimeAdapter({ mode: "connected" });
    expect(adapter.getSnapshot().mode).toBe("static");
    adapter.setSnapshot?.({ mode: "degraded" });
    expect(adapter.getSnapshot().mode).toBe("static");
  });

  it("does not accept subscriptions or updates after dispose", () => {
    const adapter = createStaticRuntimeAdapter();
    adapter.dispose?.();
    const listener = vi.fn();
    adapter.subscribe(listener);
    adapter.setSnapshot?.({ tracking: { detected: true } });
    expect(listener).not.toHaveBeenCalled();
    expect(adapter.getSnapshot()).toMatchObject({ mode: "static" });
  });

  it("merges nested preview updates without losing existing state", () => {
    const adapter = createStaticRuntimeAdapter({ camera: { active: true }, evidence: [{ id: "one", timestamp: 1 }] });
    adapter.setSnapshot?.({ tracking: { detected: true, confidence: 0.9 } });
    expect(adapter.getSnapshot()).toMatchObject({ camera: { active: true }, tracking: { detected: true, confidence: 0.9 }, evidence: [{ id: "one", timestamp: 1 }] });
  });
});

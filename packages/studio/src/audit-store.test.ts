import { describe, expect, it, vi } from "vitest";
import { AuditStore } from "./audit-store.js";

describe("AuditStore", () => {
  it("publishes immutable snapshot references to subscribers", () => {
    const store = new AuditStore({ mode: "static" });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const next = { mode: "connected" as const };
    store.setSnapshot(next);
    expect(store.getSnapshot()).toBe(next);
    expect(listener).toHaveBeenCalledWith(next);
    unsubscribe();
    store.setSnapshot({ mode: "degraded" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("ignores late runtime updates after destruction", () => {
    const store = new AuditStore({ mode: "static" });
    const listener = vi.fn();
    store.subscribe(listener);
    store.destroy();
    store.setSnapshot({ mode: "connected" });
    expect(store.getSnapshot()).toMatchObject({ mode: "static" });
    expect(listener).not.toHaveBeenCalled();
    expect(store.subscribe(vi.fn())).toBeTypeOf("function");
  });
});

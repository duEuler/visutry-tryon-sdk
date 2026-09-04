import { describe, expect, it, vi } from "vitest";
import { createLayoutResizeController } from "./layout-resize-controller.js";

describe("createLayoutResizeController", () => {
  it("coalesces resize requests and cancels pending frames on dispose", () => {
    let callback: FrameRequestCallback | undefined;
    const request = vi.fn((next: FrameRequestCallback) => { callback = next; return 7; });
    const cancel = vi.fn();
    vi.stubGlobal("requestAnimationFrame", request);
    vi.stubGlobal("cancelAnimationFrame", cancel);
    const host = { clientWidth: 800, clientHeight: 600 } as HTMLElement;
    const layout = { updateSize: vi.fn() } as never;
    const controller = createLayoutResizeController(layout, host);
    controller.schedule();
    controller.schedule();
    expect(request).toHaveBeenCalledOnce();
    callback?.(0);
    expect(layout.updateSize).toHaveBeenCalledWith(800, 600);
    controller.schedule();
    controller.dispose();
    expect(cancel).toHaveBeenCalledWith(7);
    controller.schedule();
    expect(request).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});

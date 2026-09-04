import { describe, expect, it, vi } from "vitest";
import { createReactStudioBinding } from "./react-adapter.js";

const createGoldenLayoutStudio = vi.hoisted(() => vi.fn());

vi.mock("./golden-layout-host.js", () => ({ createGoldenLayoutStudio }));

describe("createReactStudioBinding", () => {
  it("destroys the previous instance on remount and clears it on unmount", () => {
    const first = { mount: vi.fn(), destroy: vi.fn() };
    const second = { mount: vi.fn(), destroy: vi.fn() };
    createGoldenLayoutStudio.mockReturnValueOnce(first).mockReturnValueOnce(second);
    const binding = createReactStudioBinding({ panels: [], initialLayout: {} as never });
    const firstHost = document.createElement("div");
    const secondHost = document.createElement("div");

    expect(binding.getInstance()).toBeNull();
    expect(binding.mount(firstHost)).toBe(first);
    expect(first.mount).toHaveBeenCalledOnce();
    expect(createGoldenLayoutStudio).toHaveBeenCalledWith(expect.objectContaining({ host: firstHost }));

    expect(binding.mount(secondHost)).toBe(second);
    expect(first.destroy).toHaveBeenCalledOnce();
    expect(second.mount).toHaveBeenCalledOnce();
    expect(binding.getInstance()).toBe(second);

    binding.unmount();
    expect(second.destroy).toHaveBeenCalledOnce();
    expect(binding.getInstance()).toBeNull();
    binding.unmount();
    expect(second.destroy).toHaveBeenCalledOnce();
  });
});

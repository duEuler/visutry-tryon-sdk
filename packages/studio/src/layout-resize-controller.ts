import type { GoldenLayout } from "golden-layout";

export interface LayoutResizeController { schedule(): void; dispose(): void; }

export function createLayoutResizeController(layout: GoldenLayout, host: HTMLElement): LayoutResizeController {
  let frame: number | null = null;
  let disposed = false;
  const schedule = () => {
    if (disposed) return;
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      layout.updateSize(host.clientWidth, host.clientHeight);
      frame = null;
    });
  };
  return { schedule, dispose() { disposed = true; if (frame !== null) cancelAnimationFrame(frame); frame = null; } };
}

import { createGoldenLayoutStudio } from "./golden-layout-host.js";
import type { StudioInstance, StudioOptions } from "./types.js";

export type ReactStudioOptions = Omit<StudioOptions, "host">;

/**
 * Small React-friendly lifecycle bridge with no React dependency. A component
 * can call `mount(hostRef.current)` from an effect and `unmount()` in cleanup.
 */
export interface ReactStudioBinding {
  mount(host: HTMLElement): StudioInstance;
  unmount(): void;
  getInstance(): StudioInstance | null;
}

export function createReactStudioBinding(options: ReactStudioOptions): ReactStudioBinding {
  let instance: StudioInstance | null = null;
  return {
    mount(host) {
      instance?.destroy();
      instance = createGoldenLayoutStudio({ ...options, host });
      instance.mount();
      return instance;
    },
    unmount() {
      instance?.destroy();
      instance = null;
    },
    getInstance() { return instance; },
  };
}

/** Renderer boundary; Three.js and WebGL resources remain outside the Studio. */
export interface RendererAdapter {
  initialize?(): Promise<void>;
  resize?(): void;
  pause?(): void;
  resume?(): void;
  dispose?(): void;
}


/** Camera boundary; the Studio never calls getUserMedia directly. */
export interface CameraAdapter {
  initialize?(): Promise<void>;
  start?(): Promise<void>;
  stop?(): void;
  getVideo?(): HTMLVideoElement | null;
  dispose?(): void;
}


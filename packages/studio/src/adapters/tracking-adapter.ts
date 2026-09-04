import type { AuditSnapshot } from "../types.js";

/** Face/landmark tracking boundary; MediaPipe remains outside the Studio. */
export interface TrackingAdapter {
  initialize?(): Promise<void>;
  start?(): Promise<void>;
  stop?(): void;
  getSnapshot?(): AuditSnapshot;
  dispose?(): void;
}


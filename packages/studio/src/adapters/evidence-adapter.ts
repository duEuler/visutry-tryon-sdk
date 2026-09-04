import type { EvidenceFrame } from "../types.js";

/** Evidence boundary; composition of camera, overlay and GLB stays in the adapter. */
export interface EvidenceAdapter {
  initialize?(): Promise<void>;
  capture?(): Promise<EvidenceFrame>;
  dispose?(): void;
}


import type { AuditSnapshot, EvidenceFrame } from "../types.js";

export type { StudioRuntimeAdapter } from "../types.js";
export type StudioSnapshotListener = (snapshot: AuditSnapshot) => void;
export type StudioEvidenceCapture = () => Promise<EvidenceFrame>;

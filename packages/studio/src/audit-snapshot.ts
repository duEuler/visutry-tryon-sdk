import type { AuditSnapshot } from "./types.js";

/** Creates a complete, immutable-shaped snapshot while preserving extension fields. */
export function normalizeAuditSnapshot(snapshot: AuditSnapshot = {}, previous?: AuditSnapshot): AuditSnapshot {
  const base = previous ?? {};
  return {
    ...base,
    ...snapshot,
    mode: snapshot.mode ?? base.mode ?? "static",
    camera: { ...(base.camera ?? {}), ...(snapshot.camera ?? {}) },
    tracking: { ...(base.tracking ?? {}), ...(snapshot.tracking ?? {}) },
    pose: snapshot.pose === undefined ? (base.pose ?? null) : snapshot.pose,
    glb: snapshot.glb === undefined ? (base.glb ?? null) : snapshot.glb,
    render: { ...(base.render ?? {}), ...(snapshot.render ?? {}) },
    evidence: snapshot.evidence === undefined ? [...(base.evidence ?? [])] : [...snapshot.evidence],
    selectedFrameId: snapshot.selectedFrameId === undefined ? (base.selectedFrameId ?? null) : snapshot.selectedFrameId,
  };
}

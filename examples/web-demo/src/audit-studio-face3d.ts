export type AuditViewport = "front" | "top" | "left" | "right";
export type FacePoint = { x: number; y: number; z?: number };

/** Shared projection contract for the four audit viewports. */
export class AuditStudioFace3D {
  static project(point: FacePoint, view: AuditViewport): FacePoint {
    if (view === "top") return { x: point.x, y: point.z ?? 0, z: point.y };
    if (view === "left") return { x: point.z ?? 0, y: point.y, z: point.x };
    if (view === "right") return { x: -(point.z ?? 0), y: point.y, z: -point.x };
    return point;
  }
}

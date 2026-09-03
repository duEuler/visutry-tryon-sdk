import type { FaceSemanticPoints, NormalizedFaceResult, Point3D, Vector3 } from "../types/index.js";
import { distance3D } from "../utils/math.js";

export interface CanonicalFaceFrame {
  origin: Point3D;
  xAxis: Vector3;
  yAxis: Vector3;
  zAxis: Vector3;
  width: number;
  height: number;
  depth: number;
  confidence: number;
}

const sub = (a: Point3D, b: Point3D): Vector3 => ({ x: a.x - b.x, y: a.y - b.y, z: (a.z ?? 0) - (b.z ?? 0) });
const normalize = (v: Vector3): Vector3 => {
  const n = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / n, y: v.y / n, z: v.z / n };
};
const cross = (a: Vector3, b: Vector3): Vector3 => normalize({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

/**
 * Builds a stable face-local reference frame from semantic landmarks.
 * Coordinates remain in normalized-image space; consumers can transform the
 * frame to render-world or metric space without mixing viewport pixels into
 * the canonical geometry.
 */
export function buildCanonicalFaceFrame(face: NormalizedFaceResult): CanonicalFaceFrame | null {
  const s: FaceSemanticPoints = face.landmarks.semantic;
  const left = s.leftEyeCenter ?? s.leftEyeOuter;
  const right = s.rightEyeCenter ?? s.rightEyeOuter;
  const origin = s.noseBridge ?? s.eyesCenter;
  if (!left || !right || !origin) return null;

  const eyeAxis = normalize(sub(right, left));
  const top = s.foreheadCenter ?? origin;
  const bottom = s.chin ?? origin;
  // Image y points down; invert the vertical axis for a face-local frame.
  const yAxis = normalize({ x: top.x - bottom.x, y: top.y - bottom.y, z: (top.z ?? 0) - (bottom.z ?? 0) });
  const zAxis = cross(eyeAxis, yAxis);
  return {
    origin,
    xAxis: eyeAxis,
    yAxis,
    zAxis,
    width: distance3D(left, right),
    height: distance3D(top, bottom),
    depth: Math.abs((s.noseTip?.z ?? origin.z ?? 0) - (origin.z ?? 0)),
    confidence: face.pose.confidence,
  };
}

import type { FaceRegion, FaceReconstruction, ReconstructedPoint } from "./types.js";

export interface FaceReconstructionSample {
  id?: string;
  timestamp?: number;
  landmarks: Array<{ x: number; y: number; z?: number }>;
  yaw?: number;
  pitch?: number;
  roll?: number;
  confidence?: number;
  stability?: number;
  /** Normalized face size used to prefer well-framed observations. */
  faceCoverage?: number;
  /** Optional detector occlusion estimate, where 1 means fully occluded. */
  occlusion?: number;
  connections?: Array<[number, number]>;
}

export type FaceReconstructionSessionState = "idle" | "capturing" | "processing" | "completed" | "cancelled";
export interface FaceReconstructionProgress { state: FaceReconstructionSessionState; observedRegions: FaceRegion[]; missingRegions: FaceRegion[]; acceptedFrames: number; maxFrames: number; }

export interface FaceReconstructionSessionOptions {
  maxFrames?: number;
  minConfidence?: number;
  requiredRegions?: FaceRegion[];
  autoComplete?: boolean;
}

const DEFAULT_REGIONS: FaceRegion[] = ["front", "left", "right", "top", "chin", "neck", "shoulders"];
const asFinite = (value: unknown, fallback = 0): number => typeof value === "number" && Number.isFinite(value) ? value : fallback;

function classifyRegions(sample: FaceReconstructionSample): FaceRegion[] {
  const yaw = asFinite(sample.yaw);
  const pitch = asFinite(sample.pitch);
  const regions: FaceRegion[] = [];
  if (Math.abs(yaw) < 18) regions.push("front");
  if (yaw <= -12) regions.push("left");
  if (yaw >= 12) regions.push("right");
  if (pitch >= 10) regions.push("top");
  if (pitch <= -12) regions.push("chin");
  const validY = sample.landmarks.filter((point) => Number.isFinite(point.y)).map((point) => point.y);
  if (validY.some((y) => y > 0.72)) regions.push("neck");
  if (validY.some((y) => y > 0.86)) regions.push("shoulders");
  return regions.length ? regions : ["front"];
}

function scoreSample(sample: FaceReconstructionSample, targetYaw: number, targetPitch: number): number {
  const confidence = Math.max(0, Math.min(1, asFinite(sample.confidence, 0)));
  const stability = Math.max(0, Math.min(1, asFinite(sample.stability, confidence)));
  const validRatio = sample.landmarks.length ? sample.landmarks.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)).length / sample.landmarks.length : 0;
  const orientationMatch = Math.max(0, 1 - (Math.abs(asFinite(sample.yaw) - targetYaw) + Math.abs(asFinite(sample.pitch) - targetPitch)) / 90);
  const faceCoverage = Math.max(0, Math.min(1, asFinite(sample.faceCoverage, 0.75)));
  const occlusion = Math.max(0, Math.min(1, asFinite(sample.occlusion, 0)));
  return confidence * 0.4 + validRatio * 0.25 + stability * 0.2 + orientationMatch * 0.1 + faceCoverage * 0.05 - occlusion * 0.15;
}

function alignPoint(point: { x: number; y: number; z?: number }, sample: FaceReconstructionSample): { x: number; y: number; z: number } {
  const yaw = (asFinite(sample.yaw) * Math.PI) / 180;
  const pitch = (asFinite(sample.pitch) * Math.PI) / 180;
  const roll = (asFinite(sample.roll) * Math.PI) / 180;
  const cx = point.x - 0.5;
  const cy = point.y - 0.5;
  const cz = asFinite(point.z);
  const xRoll = cx * Math.cos(-roll) - cy * Math.sin(-roll);
  const yRoll = cx * Math.sin(-roll) + cy * Math.cos(-roll);
  const yPitch = yRoll * Math.cos(-pitch) - cz * Math.sin(-pitch);
  const zPitch = yRoll * Math.sin(-pitch) + cz * Math.cos(-pitch);
  const xYaw = xRoll * Math.cos(-yaw) - zPitch * Math.sin(-yaw);
  const zYaw = xRoll * Math.sin(-yaw) + zPitch * Math.cos(-yaw);
  return { x: xYaw + 0.5, y: yPitch + 0.5, z: zYaw };
}

function estimatePoint(index: number, count: number, observed: Map<number, ReconstructedPoint>): ReconstructedPoint {
  const previous = observed.get(index - 1);
  const next = observed.get(index + 1);
  if (previous && next) {
    return { index, x: (previous.x + next.x) / 2, y: (previous.y + next.y) / 2, z: (previous.z + next.z) / 2, source: "estimated", confidence: 0 };
  }
  const angle = (index / Math.max(1, count)) * Math.PI * 2;
  const ring = index % 3;
  return {
    index,
    x: 0.5 + Math.cos(angle) * (0.28 - ring * 0.035),
    y: 0.5 + Math.sin(angle) * (0.38 - ring * 0.025),
    z: Math.cos(angle * 2) * 0.08,
    source: "estimated",
    confidence: 0,
  };
}

export class FaceReconstructionSession {
  private state: FaceReconstructionSessionState = "idle";
  private readonly maxFrames: number;
  private readonly minConfidence: number;
  private readonly requiredRegions: FaceRegion[];
  private readonly samples: FaceReconstructionSample[] = [];
  private readonly bestByRegion = new Map<FaceRegion, { sample: FaceReconstructionSample; score: number }>();
  private reconstruction: FaceReconstruction | null = null;

  constructor(options: FaceReconstructionSessionOptions = {}) {
    this.maxFrames = Math.max(1, Math.min(60, Math.floor(options.maxFrames ?? 60)));
    this.minConfidence = Math.max(0, Math.min(1, options.minConfidence ?? 0.35));
    this.requiredRegions = options.requiredRegions?.length ? [...options.requiredRegions] : [...DEFAULT_REGIONS];
  }

  getState(): FaceReconstructionSessionState { return this.state; }
  getSnapshot(): FaceReconstruction | null { return this.reconstruction; }
  getProgress(): FaceReconstructionProgress {
    const observedRegions = [...this.bestByRegion.keys()];
    return { state: this.state, observedRegions, missingRegions: this.requiredRegions.filter((region) => !observedRegions.includes(region)), acceptedFrames: this.samples.length, maxFrames: this.maxFrames };
  }

  start(): void {
    this.samples.length = 0;
    this.bestByRegion.clear();
    this.reconstruction = null;
    this.state = "capturing";
  }

  ingest(sample: FaceReconstructionSample): boolean {
    if (this.state !== "capturing" || sample.landmarks.length === 0 || asFinite(sample.confidence) < this.minConfidence) return false;
    const normalized: FaceReconstructionSample = { ...sample, id: sample.id ?? `frame-${this.samples.length + 1}`, timestamp: sample.timestamp ?? Date.now() };
    this.samples.push(normalized);
    if (this.samples.length > this.maxFrames) this.samples.splice(0, this.samples.length - this.maxFrames);
    const regions = classifyRegions(normalized);
    const target = regions.includes("front") ? 0 : regions.includes("top") ? 0 : regions.includes("left") ? -30 : 30;
    const score = scoreSample(normalized, target, regions.includes("top") ? 15 : regions.includes("chin") ? -15 : 0);
    regions.forEach((region) => {
      const previous = this.bestByRegion.get(region);
      if (!previous || score > previous.score) this.bestByRegion.set(region, { sample: normalized, score });
    });
    return true;
  }

  finish(): FaceReconstruction {
    if (this.state !== "capturing") return this.reconstruction ?? this.buildReconstruction();
    this.state = "processing";
    this.reconstruction = this.buildReconstruction();
    this.state = "completed";
    return this.reconstruction;
  }

  cancel(): void { this.samples.length = 0; this.bestByRegion.clear(); this.reconstruction = null; this.state = "cancelled"; }

  private buildReconstruction(): FaceReconstruction {
    const byIndex = new Map<number, ReconstructedPoint>();
    const observedRegions = [...this.bestByRegion.keys()];
    this.bestByRegion.forEach(({ sample, score }) => sample.landmarks.forEach((point, index) => {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
      const aligned = alignPoint(point, sample);
      const previous = byIndex.get(index);
      if (!previous || score > previous.confidence) byIndex.set(index, { index, x: aligned.x, y: aligned.y, z: aligned.z, source: "observed", confidence: score, frameId: sample.id });
    }));
    const count = Math.max(478, ...this.samples.map((sample) => sample.landmarks.length), 1);
    const landmarks = Array.from({ length: count }, (_, index) => byIndex.get(index) ?? estimatePoint(index, count, byIndex));
    const estimatedRegions = this.requiredRegions.filter((region) => !observedRegions.includes(region));
    const coverage = landmarks.length ? landmarks.filter((point) => point.source === "observed").length / landmarks.length : 0;
    const confidence = landmarks.length ? landmarks.reduce((sum, point) => sum + point.confidence, 0) / landmarks.length : 0;
    const connections = this.samples.find((sample) => sample.connections?.length)?.connections;
    return { landmarks, connections, observedRegions, estimatedRegions, coverage, confidence, capturedFrames: this.samples.length, completed: true, frozenAt: Date.now() };
  }
}

export function createFaceReconstructionSession(options?: FaceReconstructionSessionOptions): FaceReconstructionSession {
  return new FaceReconstructionSession(options);
}

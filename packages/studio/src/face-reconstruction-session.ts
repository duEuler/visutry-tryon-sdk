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
}

export type FaceReconstructionSessionState = "idle" | "capturing" | "processing" | "completed" | "cancelled";

export interface FaceReconstructionSessionOptions {
  maxFrames?: number;
  minConfidence?: number;
  requiredRegions?: FaceRegion[];
}

const DEFAULT_REGIONS: FaceRegion[] = ["front", "left", "right", "top", "chin"];
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
  return regions.length ? regions : ["front"];
}

function scoreSample(sample: FaceReconstructionSample): number {
  const confidence = Math.max(0, Math.min(1, asFinite(sample.confidence, 0)));
  const stability = Math.max(0, Math.min(1, asFinite(sample.stability, confidence)));
  const validRatio = sample.landmarks.length ? sample.landmarks.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)).length / sample.landmarks.length : 0;
  return confidence * 0.5 + validRatio * 0.3 + stability * 0.2;
}

function estimatePoint(index: number, count: number): ReconstructedPoint {
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
    this.maxFrames = Math.max(1, Math.floor(options.maxFrames ?? 60));
    this.minConfidence = Math.max(0, Math.min(1, options.minConfidence ?? 0.35));
    this.requiredRegions = options.requiredRegions?.length ? [...options.requiredRegions] : [...DEFAULT_REGIONS];
  }

  getState(): FaceReconstructionSessionState { return this.state; }
  getSnapshot(): FaceReconstruction | null { return this.reconstruction; }

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
    const score = scoreSample(normalized);
    classifyRegions(normalized).forEach((region) => {
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
      const previous = byIndex.get(index);
      if (!previous || score > previous.confidence) byIndex.set(index, { index, x: point.x, y: point.y, z: asFinite(point.z), source: "observed", confidence: score, frameId: sample.id });
    }));
    const count = Math.max(478, ...this.samples.map((sample) => sample.landmarks.length), 1);
    const landmarks = Array.from({ length: count }, (_, index) => byIndex.get(index) ?? estimatePoint(index, count));
    const estimatedRegions = this.requiredRegions.filter((region) => !observedRegions.includes(region));
    const coverage = landmarks.length ? landmarks.filter((point) => point.source === "observed").length / landmarks.length : 0;
    const confidence = landmarks.length ? landmarks.reduce((sum, point) => sum + point.confidence, 0) / landmarks.length : 0;
    return { landmarks, observedRegions, estimatedRegions, coverage, confidence, capturedFrames: this.samples.length, completed: true, frozenAt: Date.now() };
  }
}

export function createFaceReconstructionSession(options?: FaceReconstructionSessionOptions): FaceReconstructionSession {
  return new FaceReconstructionSession(options);
}

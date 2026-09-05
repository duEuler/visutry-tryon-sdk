/// <reference types="vitest/globals" />

import { FaceReconstructionSession } from "./face-reconstruction-session.js";

const sample = (id: string, yaw: number, pitch = 0, confidence = 0.95) => ({
  id, yaw, pitch, confidence, stability: 0.9,
  landmarks: Array.from({ length: 6 }, (_, index) => ({ x: 0.2 + index * 0.1, y: 0.3 + index * 0.02, z: index * 0.01 })),
});

describe("FaceReconstructionSession", () => {
  it("does not become ready before lateral coverage is captured", () => {
    const session = new FaceReconstructionSession({ requiredRegions: ["front", "left", "right"] });
    session.start();
    expect(session.ingest(sample("front", 0))).toBe(true);
    expect(session.canFinish()).toBe(false);
    expect(session.getProgress().missingRegions).toEqual(["left", "right"]);
    expect(session.ingest(sample("left", -30))).toBe(true);
    expect(session.canFinish()).toBe(false);
    expect(session.ingest(sample("right", 30))).toBe(true);
    expect(session.canFinish()).toBe(true);
  });

  it("accumulates oriented frames and freezes a reconstruction", () => {
    const session = new FaceReconstructionSession({ minConfidence: 0.4 });
    session.start();
    expect(session.ingest(sample("front", 0))).toBe(true);
    expect(session.getProgress().observedRegions).toContain("front");
    expect(session.ingest(sample("left", -30))).toBe(true);
    expect(session.ingest(sample("right", 30))).toBe(true);
    expect(session.ingest(sample("top", 0, 20))).toBe(true);
    const result = session.finish();
    expect(result.completed).toBe(true);
    expect(result.capturedFrames).toBe(4);
    expect(result.observedRegions).toEqual(expect.arrayContaining(["front", "left", "right", "top"]));
    expect(result.landmarks.some((point) => point.source === "observed")).toBe(true);
    expect(result.landmarks.some((point) => point.source === "estimated")).toBe(true);
    expect(session.getState()).toBe("completed");
    expect(session.getSnapshot()).toBe(result);
  });

  it("rejects low-confidence frames and never replaces real points with estimates", () => {
    const session = new FaceReconstructionSession({ minConfidence: 0.5, maxFrames: 2 });
    session.start();
    expect(session.ingest(sample("bad", 0, 0, 0.2))).toBe(false);
    expect(session.ingest(sample("good", 0))).toBe(true);
    expect(session.ingest(sample("good-2", 0))).toBe(true);
    expect(session.ingest(sample("good-3", 0))).toBe(true);
    const result = session.finish();
    expect(result.capturedFrames).toBe(2);
    expect(result.landmarks[0].source).toBe("observed");
  });

  it("cancels and can start a fresh capture", () => {
    const session = new FaceReconstructionSession();
    session.start();
    session.ingest(sample("one", 0));
    session.cancel();
    expect(session.getState()).toBe("cancelled");
    expect(session.getSnapshot()).toBeNull();
    session.start();
    expect(session.getState()).toBe("capturing");
  });
});

import { describe, expect, it } from "vitest";
import { normalizeAuditSnapshot } from "./audit-snapshot.js";

describe("normalizeAuditSnapshot", () => {
  it("provides stable defaults and preserves partial updates", () => {
    const first = normalizeAuditSnapshot({ camera: { active: true }, evidence: [{ id: "one", timestamp: 1 }] });
    const next = normalizeAuditSnapshot({ tracking: { detected: true, confidence: 0.95 } }, first);
    expect(next).toMatchObject({ mode: "static", camera: { active: true }, tracking: { detected: true, confidence: 0.95 }, pose: null, glb: null, selectedFrameId: null });
    expect(next.evidence).toEqual([{ id: "one", timestamp: 1 }]);
    expect(next.evidence).not.toBe(first.evidence);
  });
});

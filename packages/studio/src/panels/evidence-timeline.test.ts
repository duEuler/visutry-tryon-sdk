import { describe, expect, it } from "vitest";
import { renderEvidenceTimeline } from "./evidence-timeline.js";

describe("renderEvidenceTimeline", () => {
  it("renders captured image data and escapes labels", () => {
    const html = renderEvidenceTimeline([{ label: "<frame>", dataUrl: "data:image/png;base64,AAAA", best: true }]);
    expect(html).toContain('class="thumb-image"');
    expect(html).toContain("data:image/png;base64,AAAA");
    expect(html).toContain("&lt;frame&gt;");
  });

  it("does not inject non-image URLs", () => {
    const html = renderEvidenceTimeline([{ label: "frame", dataUrl: "javascript:alert(1)" }]);
    expect(html).not.toContain("thumb-image");
    expect(html).not.toContain("javascript:");
  });
});

import { describe, expect, it } from "vitest";
import { renderMetricGrid } from "./metric-grid.js";

describe("renderMetricGrid", () => {
  it("escapes labels and values while preserving status styling", () => {
    const html = renderMetricGrid([{ label: "<Fonte>", value: '"unsafe" & value', status: true }]);
    expect(html).toContain("&lt;Fonte&gt;");
    expect(html).toContain("&quot;unsafe&quot; &amp; value");
    expect(html).toContain('class="status"');
    expect(html).not.toContain("<Fonte>");
  });
});

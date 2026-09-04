import { describe, expect, it } from "vitest";
import { createDefaultStudioLayout } from "./layout-contract.js";

describe("createDefaultStudioLayout", () => {
  it("keeps side docks full height and bottom panels in the center column", () => {
    const root = createDefaultStudioLayout().root as any;
    expect(root.type).toBe("row");
    expect(root.content.map((item: any) => item.componentType)).toEqual(["leftDock", undefined, "rightDock"]);
    const center = root.content[1];
    expect(center.type).toBe("column");
    expect(center.content[0].content.map((item: any) => item.componentType)).toEqual(["live", "viewports"]);
    expect(center.content[1].content.map((item: any) => item.componentType)).toEqual(["evidence", "selected"]);
    expect(center.content[1].height).toBe(18);
  });
});

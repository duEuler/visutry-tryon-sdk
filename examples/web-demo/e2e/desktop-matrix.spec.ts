import { expect, test } from "@playwright/test";

test.describe("Golden Layout Studio desktop matrix", () => {
  test("fits the workspace without document scrolling", async ({ page }) => {
    await page.goto("/golden-layout-studio/index.html");
    await expect(page.locator("#layout-host")).toBeVisible();
    const geometry = await page.evaluate(() => ({
      viewport: { width: window.innerWidth, height: window.innerHeight },
      pageScroll: document.documentElement.scrollHeight > window.innerHeight,
      host: document.getElementById("layout-host")?.getBoundingClientRect(),
      columns: document.querySelectorAll('[data-panel-id="leftDock"], [data-panel-id="rightDock"]').length,
    }));
    expect(geometry.pageScroll).toBe(false);
    expect(geometry.columns).toBe(2);
    expect(geometry.host?.height).toBeGreaterThan(300);
    await expect(page.locator('[data-panel-id="live"]')).toBeVisible();
    await expect(page.locator('[data-panel-id="viewports"]')).toBeVisible();
    await expect(page.locator('[data-panel-id="evidence"]')).toBeVisible();
    await expect(page.locator("#studio-mode")).toHaveText("static");
    for (const id of ["start-camera", "start-tryon", "load-glb", "capture-evidence", "stop-runtime"]) {
      await expect(page.locator(`#${id}`)).toBeDisabled();
    }
  });
});

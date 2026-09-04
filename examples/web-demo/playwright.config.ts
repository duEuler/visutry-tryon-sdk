import { defineConfig, devices } from "@playwright/test";

const useFakeCamera = process.env.VISUTRY_E2E_FAKE_CAMERA === "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    // Prefer IPv4 so another local service bound to ::1 cannot be reused by accident.
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
    // Grant camera permission for all tests
    permissions: ["camera"],
    ...(useFakeCamera ? {
      launchOptions: {
        args: ["--use-fake-device-for-media-stream"],
      },
    } : {}),
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});

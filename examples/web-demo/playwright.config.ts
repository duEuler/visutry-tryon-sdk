import { defineConfig, devices } from "@playwright/test";

const useFakeCamera = process.env.VISUTRY_E2E_FAKE_CAMERA === "1";
const useCrossBrowser = process.env.VISUTRY_E2E_CROSS_BROWSER === "1";
const chromiumRuntime = useFakeCamera
  ? {
      permissions: ["camera"],
      launchOptions: {
        args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
      },
    }
  : {};

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
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], ...chromiumRuntime } },
    {
      name: "desktop-1366",
      testMatch: /desktop-matrix\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        ...chromiumRuntime,
        viewport: { width: 1366, height: 768 },
      },
    },
    {
      name: "desktop-1920",
      testMatch: /desktop-matrix\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        ...chromiumRuntime,
        viewport: { width: 1920, height: 1080 },
      },
    },
    ...(useCrossBrowser
      ? [
          {
            name: "firefox-desktop",
            testMatch: /desktop-matrix\.spec\.ts/,
            use: { ...devices["Desktop Firefox"] },
          },
          {
            name: "webkit-desktop",
            testMatch: /desktop-matrix\.spec\.ts/,
            use: { ...devices["Desktop Safari"] },
          },
        ]
      : []),
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});

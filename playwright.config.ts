import { defineConfig } from "@playwright/test";

const demoRun = process.env.npm_lifecycle_event === "demo" || process.env.npm_lifecycle_event === "demo:e2e" || process.env.npm_lifecycle_event === "demo:chunks";

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: demoRun ? undefined : "**/*demo*.spec.ts",
  timeout: 90_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: "test-results/artifacts",
  reporter: [["list"], ["./tests/e2e/SummaryReporter.ts"], ["html", { outputFolder: "test-results/report", open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    headless: !demoRun,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: demoRun ? "on" : "off",
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

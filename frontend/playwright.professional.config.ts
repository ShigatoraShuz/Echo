import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e", testMatch: ["completion-sprint.spec.ts", "journeys.spec.ts", "navigation.spec.ts", "preview.spec.ts", "responsive.spec.ts", "mobile-workspace.spec.ts", "performance.spec.ts", "professional-ui.spec.ts", "messenger.spec.ts", "clinician-preview.spec.ts", "user-professional-integration.spec.ts", "refinement.spec.ts", "shared-onboarding.spec.ts"], fullyParallel: false, workers: 1,
  timeout: 30_000, expect: { timeout: 8_000 }, retries: 0, reporter: "list",
  outputDir: "./e2e/.artifacts",
  use: { baseURL: "http://127.0.0.1:3101", channel: process.env.ECHO_E2E_BROWSER_CHANNEL || "msedge", headless: true, trace: "off", screenshot: "off", video: "off", reducedMotion: "reduce" },
  webServer: { command: "npx vite --config e2e/vite.config.ts", url: "http://127.0.0.1:3101", reuseExistingServer: false, timeout: 30_000 },
});

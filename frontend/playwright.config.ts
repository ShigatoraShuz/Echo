import { defineConfig } from "@playwright/test";
import professional from "./playwright.professional.config";
import mobile from "./playwright.mobile.config";

// Default discovery includes both isolated Professional journeys and Lloyd's
// actual Next.js mobile QA. Staging stays explicitly opt-in in its guarded config.
export default defineConfig({
  testDir: "./e2e", workers: 2, retries: 0, reporter: "list",
  timeout: 30_000, expect: { timeout: 8_000 },
  outputDir: "./e2e/.artifacts",
  webServer: [professional.webServer!, mobile.webServer!].flat(),
  projects: [
    { name: "professional-mocked", testMatch: professional.testMatch, use: professional.use, fullyParallel: false },
    ...(mobile.projects ?? []).map((project) => ({ ...project, testMatch: mobile.testMatch, use: { ...mobile.use, ...project.use } })),
  ],
});

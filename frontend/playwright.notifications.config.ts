import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", testMatch: "user-notifications.spec.ts", workers: 1, fullyParallel: false,
  timeout: 30_000, expect: { timeout: 8_000 }, reporter: "list",
  outputDir: "./e2e/.artifacts/user-notifications",
  use: { baseURL: "http://127.0.0.1:3101", headless: true, reducedMotion: "reduce", trace: "off" },
  webServer: { command: "npx vite --config e2e/vite.config.ts", url: "http://127.0.0.1:3101", reuseExistingServer: false, timeout: 30_000 },
});

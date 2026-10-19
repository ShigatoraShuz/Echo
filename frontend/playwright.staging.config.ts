import { readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.ECHO_STAGING_BASE_URL;
const projectRef = process.env.ECHO_STAGING_PROJECT_REF;
const supabaseUrl = process.env.ECHO_STAGING_SUPABASE_URL;
if (!baseURL || !projectRef || !supabaseUrl) {
  throw new Error("Set ECHO_STAGING_BASE_URL, ECHO_STAGING_PROJECT_REF, and ECHO_STAGING_SUPABASE_URL.");
}
const web = new URL(baseURL);
const database = new URL(supabaseUrl);
if (web.protocol !== "https:" || database.protocol !== "https:" ||
    ["localhost", "127.0.0.1"].includes(web.hostname) ||
    database.hostname !== `${projectRef}.supabase.co`) {
  throw new Error("Staging must use HTTPS and the declared separate Supabase project.");
}
try {
  const linkedRef = readFileSync(path.resolve(process.cwd(), "../supabase/.temp/project-ref"), "utf8").trim();
  if (linkedRef === projectRef) throw new Error("Staging QA cannot target the currently linked Supabase project.");
} catch (error) {
  if (error instanceof Error && "code" in error && error.code === "ENOENT") {
    // CI checkouts may not have a linked local project.
  } else {
    throw error;
  }
}

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/staging-*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-staging-report" }], ["./e2e/staging-performance-reporter.ts"]],
  use: {
    baseURL: web.origin,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile-chrome", use: { ...devices["Pixel 5"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 13"] } },
    { name: "narrow-mobile", use: { ...devices["Pixel 5"], viewport: { width: 320, height: 700 } } },
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 }, hasTouch: true } },
  ],
});

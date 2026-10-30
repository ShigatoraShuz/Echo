import { consultationOrigin } from "./lib/consultation-origin.mts";
/** Visible, normal UI sign-in with private local synthetic credentials. No injected session or role. */
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { localEnvironment, localFetch, LOCAL_API, assertFixtureUser } from "./lib/professional-local-target.mts";

const target = localEnvironment(process.cwd()), fixtures = JSON.parse(readFileSync("backend/tmp/student-consultation/state.json", "utf8"));
if (fixtures.fingerprint !== target.fingerprint || fixtures.tag !== "echo-student-consultation-v1") throw new Error("Fixture mismatch");
const index = process.argv[2] === "student-b" ? 1 : process.argv[2] === undefined || process.argv[2] === "student-a" ? 0 : -1;
if (index < 0) throw new Error("Use student-a|student-b");
const account = fixtures.accounts[index];
const admin = createClient(LOCAL_API, target.serviceKey, { auth: { persistSession: false }, global: { fetch: localFetch } });
const user = await admin.auth.admin.getUserById(account.id);
if (user.error || !user.data.user) throw new Error("Local fixture missing");
assertFixtureUser(user.data.user, account.email);
if (user.data.user.app_metadata.consultation_demo !== true) throw new Error("Not a consultation fixture");
const check = process.argv.includes("--check");
const browser = await chromium.launch({ channel: "msedge", headless: check });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${consultationOrigin()}/login?next=/dashboard`);
  await page.getByRole("button", { name: "Use password instead" }).click();
  await page.getByLabel(/^Email address/).fill(account.email);
  await page.locator('input[type="password"]').fill(account.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL(url => !url.pathname.includes("login"), { timeout: 60000 });
  process.stdout.write("Local fictional student demo opened. Close its browser window to end this launcher. Credentials were not printed.\n");
  if (!check) await new Promise<void>(resolve => browser.once("disconnected", resolve));
} finally { await browser.close(); }

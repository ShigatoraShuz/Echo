import { consultationOrigin } from "./lib/consultation-origin.mts";
/** Read-only browser checks of the already persisted fictional conversations and self-reports. */
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { localEnvironment } from "./lib/professional-local-target.mts";
const target = localEnvironment(process.cwd()), fixtures = JSON.parse(readFileSync("backend/tmp/student-consultation/state.json", "utf8"));
if (fixtures.fingerprint !== target.fingerprint || fixtures.tag !== "echo-student-consultation-v1") throw new Error("Fixture mismatch");
const evidence = "artifacts/model-integration/live-initial-20261030/browser";
const journeys = JSON.parse(readFileSync(`${evidence}/browser-results.json`, "utf8")).journeys;
const browser = await chromium.launch({ channel: "msedge", headless: true });
const checks = [];
try {
  for (const [index, width] of [1440, 390].entries()) {
    if (index) for (let n = 0; n < 2; n++) await new Promise(resolve => setTimeout(resolve, 30000));
    const account = fixtures.accounts[index], journey = journeys[index];
    if (journey.studentId !== account.id) throw new Error("Journey owner mismatch");
    const context = await browser.newContext({ baseURL: consultationOrigin(), viewport: { width, height: 1000 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto(`/login?next=${encodeURIComponent(`/buddy?conversation=${journey.buddy.conversationId}`)}`);
    await page.getByRole("button", { name: "Use password instead" }).click(); await page.getByLabel(/^Email address/).fill(account.email);
    await page.locator('input[type="password"]').fill(account.password); await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.waitForURL(url => !url.pathname.includes("login"), { timeout: 60000 });
    await expect(page.getByText("Fictional consultation: a grounding exercise please.", { exact: true })).toBeVisible({ timeout: 30000 });
    const buddy = page.getByRole("region", { name: "Buddy chat", exact: true });
    for (const theme of ["light", "dark"]) {
      await page.evaluate(dark => document.documentElement.classList.toggle("dark", dark), theme === "dark");
      await page.waitForTimeout(400);
      const axe = await new AxeBuilder({ page }).include('[aria-label="Buddy chat"]').withTags(["wcag2a", "wcag2aa"]).analyze();
      if (axe.violations.length) writeFileSync(`${evidence}/ui-violations.json`, JSON.stringify(axe.violations, null, 2));
      expect(axe.violations.map(v => v.id)).toEqual([]);
      await buddy.screenshot({ path: `${evidence}/buddy-${width}-${theme}-verified.png` });
      checks.push({ feature: "Buddy", width, theme, restoredExchangeVisible: true, wcagViolations: 0 });
    }
    await page.goto("/dashboard");
    const close = page.getByRole("button", { name: "Close dialog", exact: true });
    await close.waitFor({ timeout: 2500 }).catch(() => {}); if (await close.isVisible()) await close.click();
    await page.getByRole("button", { name: "Open check-in panel" }).click();
    await page.getByText("Self-reported PHQ-8 history", { exact: true }).click();
    await page.getByRole("button", { name: index ? /8\/8 answered.*Total 8/ : /2\/8 answered.*Partial subtotal 2/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(page.getByRole("definition").filter({ hasText: "Unanswered" })).toHaveCount(index ? 0 : 6);
    for (const theme of ["light", "dark"]) {
      await page.evaluate(dark => document.documentElement.classList.toggle("dark", dark), theme === "dark");
      await page.waitForTimeout(400);
      const axe = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa"]).analyze();
      if (axe.violations.length) writeFileSync(`${evidence}/ui-phq8-violations.json`, JSON.stringify(axe.violations, null, 2));
      expect(axe.violations.map(v => v.id)).toEqual([]);
      await dialog.screenshot({ path: `${evidence}/self-report-${width}-${theme}-verified.png` });
      checks.push({ feature: "PHQ8 saved self-report", width, theme, nullsPreserved: true, wcagViolations: 0 });
    }
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    await page.getByRole("button", { name: "Close dialog", exact: true }).click();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
    const dockClose = page.getByRole("button", { name: "Close check-in panel", exact: true });
    if (await dockClose.isVisible()) await dockClose.click();
    await page.getByRole("button", { name: /^Notifications/ }).click();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    await page.getByRole("button", { name: "Close notifications", exact: true }).click();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
    await page.goto("/analysis-preview");
    await page.getByRole("tablist", { name: "Analysis preview states" }).waitFor();
    await page.mouse.move(Math.round(width * .65), 700);
    await page.mouse.wheel(0, 700);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
    checks.push({ feature: "Dialog and notification lock cleanup", width, activeLockPreserved: true, closedLockReleased: true, previewWheelScrolls: true });
    await context.close();
  }
  writeFileSync(`${evidence}/ui-results.json`, JSON.stringify({ checks }, null, 2));
  process.stdout.write("Persisted Buddy and self-report: desktop/mobile, light/dark, eight WCAG A/AA checks passed.\n");
} finally { await browser.close(); }

/** Real browser input regression. Public synthetic preview only; no Auth or DB writes. */
import { chromium, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { consultationOrigin } from "./lib/consultation-origin.mts";
import { modelEvidenceDirectory } from "./lib/model-evidence.mts";

const evidence = modelEvidenceDirectory("artifacts/model-integration/live-initial-20261030/scroll");
mkdirSync(evidence, { recursive: true });
const results: Record<string, unknown>[] = [];
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ baseURL: consultationOrigin(), viewport: { width, height: 850 }, hasTouch: width === 390, reducedMotion: "reduce" });
    const page = await context.newPage();
    const snapshot = () => page.evaluate(() => ({ y: scrollY, height: document.documentElement.scrollHeight, viewport: innerHeight, html: getComputedStyle(document.documentElement).overflowY, body: getComputedStyle(document.body).overflowY, inlineBody: document.body.style.overflow, page: getComputedStyle(document.querySelector(".echo-workspace-page")!).overflowY, overscroll: getComputedStyle(document.querySelector(".echo-workspace-page")!).overscrollBehaviorY }));
    async function scroll(label: string) {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      const currentWidth = page.viewportSize()!.width;
      await page.mouse.move(Math.round(currentWidth * .65), 650);
      await page.mouse.wheel(0, 700);
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
      const wheel = await snapshot();
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
      await page.keyboard.press("PageDown");
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
      results.push({ width, label, wheel, keyboard: await snapshot() });
    }
    await page.goto("/analysis-preview");
    await page.getByRole("tablist", { name: "Analysis preview states" }).waitFor();
    for (let cycle = 0; cycle < 3; cycle++) {
      if (cycle) await page.reload();
      for (const dark of [false, true]) {
        await page.evaluate(value => document.documentElement.classList.toggle("dark", value), dark);
        await scroll(`reload-${cycle}-${dark ? "dark" : "light"}`);
      }
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    if (width === 1440) {
      await page.getByRole("button", { name: /^Profile menu/ }).click();
      await expect(page.getByRole("menu")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("menu")).not.toBeVisible();
      await scroll("profile-dropdown-close");
    }
    if (width === 390) {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.getByRole("button", { name: "Open navigation", exact: true }).click();
      await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");
      await page.getByRole("button", { name: "Close menu", exact: true }).click();
      await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
      await scroll("mobile-menu-close");
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      const cdp = await context.newCDPSession(page);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 260, y: 700 }] });
      for (const y of [620, 520, 400, 280]) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 260, y }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
      results.push({ width, label: "native-touch", state: await snapshot() });
      await cdp.detach();
    }
    await page.setViewportSize({ width: width === 390 ? 1440 : 390, height: 850 });
    await scroll("resize");
    await page.setViewportSize({ width, height: 850 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.getByRole("link", { name: "Back to journal", exact: true }).click();
    await page.waitForURL(url => url.pathname !== "/analysis-preview");
    await page.goBack();
    await page.getByRole("tablist", { name: "Analysis preview states" }).waitFor();
    await scroll("client-navigation-history-return");
    await page.screenshot({ path: `${evidence}/after-${width}.png`, fullPage: true });
    await context.close();
  }
} finally {
  writeFileSync(`${evidence}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
process.stdout.write(JSON.stringify({ passed: results.length, widths: [1440, 390] }) + "\n");

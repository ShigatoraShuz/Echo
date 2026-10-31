import { expect, test, type Page } from "@playwright/test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fixtures } from "./fixtures";

// Reuse Next's locally cached brand fonts for screenshots, when available.
// No downloads, production font changes, or dependency on a particular cache hash.
async function cachedBrandFonts(page: Page) {
  const chunks = path.resolve("tmp/professional-next/dev/static/chunks");
  if (!existsSync(chunks)) return;
  const styles = readdirSync(chunks).filter((name) => /^\[next\]_internal_font_google_(manrope|cormorant_garamond)_.*\.single\.css$/.test(name));
  const faces = styles.flatMap((name) => readFileSync(path.join(chunks, name), "utf8").match(/@font-face\s*\{[^}]+\}/g) ?? []).map((face) => face.replace(/url\("([^\"]+)"\)/g, (_, file: string) => `url("data:font/woff2;base64,${readFileSync(path.resolve(chunks, file)).toString("base64")}")`));
  if (!faces.length) return;
  await page.addStyleTag({ content: `${faces.join("\n")} :root { --font-echo-sans: 'Manrope', sans-serif; --font-echo-display: 'Cormorant Garamond', serif; }` });
  await page.evaluate(() => document.fonts.ready);
}

test("mobile menu traps focus, restores its trigger, and keeps secondary destinations accessible", async ({ page }) => {
  await fixtures(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/professional?organization=org-one");
  const trigger = page.getByRole("button", { name: "Open workspace menu" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Your workspace" });
  await expect(dialog).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await dialog.getByRole("button", { name: "Sign out" }).focus();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Close dialog" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByRole("link", { name: "Resources" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Professional resources" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Today, at a glance" })).toBeVisible();
  await trigger.click();
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
});

test("mobile filters are deliberate disclosures and bottom navigation stays clear of content", async ({ page }) => {
  await fixtures(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/professional/requests?organization=org-one");
  await expect(page.getByLabel("Search request ID")).toBeHidden();
  await page.getByRole("button", { name: "Search and filters" }).click();
  await page.getByLabel("Search request ID").fill("no-fictional-match");
  await expect(page.getByText("No requests match this view.")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByRole("button", { name: "Search and filters" }).click();
  const lastAction = page.getByRole("link", { name: "Open case", exact: true });
  await lastAction.focus();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const content = await lastAction.boundingBox();
  const nav = page.getByRole("navigation", { name: "Professional mobile navigation" });
  const bottom = await nav.boundingBox();
  expect(content!.y + content!.height).toBeLessThan(bottom!.y);
  for (const link of await nav.getByRole("link").all()) {
    const box = await link.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
});

for (const width of [390, 1440]) {
  test(`capture Professional workspace at ${width}px with fictional data`, async ({ page }, testInfo) => {
    await fixtures(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/professional?organization=org-one");
    await expect(page.getByRole("button", { name: "Accept request", exact: true })).toBeVisible();
    await cachedBrandFonts(page);
    await page.screenshot({ path: testInfo.outputPath(`professional-${width}.png`), fullPage: true });
    await page.screenshot({ path: testInfo.outputPath(`professional-${width}-viewport.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}

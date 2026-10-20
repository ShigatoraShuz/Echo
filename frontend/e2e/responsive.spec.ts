import { expect, test, type Page } from "@playwright/test";
import { caseId, fixtures } from "./fixtures";

async function fits(page: Page) {
  expect(await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }))).toEqual(expect.objectContaining({ document: await page.evaluate(() => innerWidth) }));
}
for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
  test(`professional screens fit ${width}px`, async ({ page }) => {
    await fixtures(page); await page.setViewportSize({ width, height: 900 });
    for (const path of ["/professional/login", "/professional/access", "/professional", "/professional/requests", "/professional/my-cases", "/professional/calendar", "/professional/resources", `/professional/cases/${caseId}`]) {
      await page.goto(path); await expect(page.locator("h1")).toBeVisible(); await expect(page.getByText("Checking professional access", { exact: true })).toHaveCount(0);
      if (path.includes("/cases/")) await expect(page.getByText("Fictional shared message for browser tests")).toBeVisible();
      await fits(page);
    }
    await page.getByRole("button", { name: "Close case", exact: true }).click();
    const dialog = page.getByRole("dialog"); await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width); expect(box!.y + box!.height).toBeLessThanOrEqual(900);
    await page.keyboard.press("Escape"); await expect(page.getByRole("button", { name: "Close case", exact: true })).toBeFocused();
    if (width === 320) {
      const home = await page.getByRole("link", { name: "ECHO professional home", exact: true }).boundingBox();
      expect(home!.width).toBeGreaterThanOrEqual(44);
      expect(home!.height).toBeGreaterThanOrEqual(44);
    }
  });
}

test("uncertain-save recovery fits a narrow case panel", async ({ page }) => {
  const state = await fixtures(page); await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(`/professional/cases/${caseId}`);
  await page.getByLabel("New case note").fill("Fictional note for recovery inspection");
  state.faults.addNote = { status: 503, code: "SERVER_ERROR" };
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await page.getByRole("button", { name: "Refresh case", exact: true }).click();
  const recovery = page.getByRole("button", { name: "I reviewed the notes; enable a new note" });
  await expect(recovery).toBeVisible();
  const box = await recovery.boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(360);
  await fits(page);
});

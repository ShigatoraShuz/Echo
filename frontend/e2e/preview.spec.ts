import { expect, test } from "@playwright/test";
import { fixtures } from "./fixtures";

for (const width of [360, 768, 1280, 1920]) {
  test(`synthetic inspectors and dialogs fit ${width}px without any API calls`, async ({ page }) => {
    const state = await fixtures(page); await page.setViewportSize({ width, height: 740 });
    await page.goto("/synthetic-preview");
    for (const title of ["Inspect synthetic organization choices", "Inspect request management", "Inspect synthetic case workspace", "Inspect synthetic care coordination", "Inspect synthetic crisis support"]) {
      await page.getByText(title, { exact: true }).click();
    }
    await expect(page.getByLabel("Synthetic crisis state")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.getByRole("button", { name: "Inspect cancellation confirmation" }).click();
    const dialog = page.getByRole("dialog"); await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(box!.y).toBeGreaterThanOrEqual(0); expect(box!.y + box!.height).toBeLessThanOrEqual(740);
    await expect(dialog.getByRole("button", { name: "Confirm cancellation" })).toBeDisabled();
    await page.keyboard.press("Escape");
    for (const scenario of ["ready", "loading", "empty", "denied", "network", "server"]) {
      await page.getByLabel("Synthetic crisis state").selectOption(scenario);
      await expect(page.getByRole("button", { name: "Escalation unavailable" })).toBeDisabled();
    }
    expect(state.calls).toHaveLength(0);
  });
}

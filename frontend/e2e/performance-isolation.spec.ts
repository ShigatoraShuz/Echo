import { expect, test } from "@playwright/test";
import { fixtures, caseId } from "./fixtures";

test("notification intent preloads code only; closing during code loading does not fetch another inbox", async ({ page }) => {
  const state = await fixtures(page);
  let release!: () => void;
  const hold = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/*professional-notification-center*", async route => { await hold; await route.continue(); });
  await page.goto("/professional?organization=org-one");
  await expect(page.getByRole("link", { name: "Open case", exact: true })).toBeVisible();
  await expect.poll(() => state.calls.filter(c => c.method === "notifications").length).toBe(1);
  const button = page.getByRole("button", { name: "Notifications", exact: true });
  await button.focus(); await button.click();
  await expect(page.getByText("Opening notifications", { exact: false })).toBeVisible();
  await page.keyboard.press("Escape"); release();
  await expect(page.getByRole("dialog", { name: "Notifications", exact: true })).toHaveCount(0);
  expect(state.calls.filter(c => c.method === "notifications")).toHaveLength(1);
  expect(state.calls.filter(c => c.method === "caseMessages")).toHaveLength(0);
});

for (const width of [1440, 390]) for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${width}px ${colorScheme} bounded workspace`, () => {
    test.use({ viewport: { width, height: 1000 }, colorScheme });
    test("deduplicates a badge/panel refresh burst and requests only this clinician's My Cases", async ({ page }) => {
      const state = await fixtures(page); state.paginatedQueue = true;
      await page.goto("/professional/my-cases?organization=org-one");
      await expect(page.getByRole("link", { name: "Open case", exact: true })).toBeVisible();
      expect(state.calls.find(c => c.method === "queue")?.args).toEqual(["org-one", { assignedTo: "actor-one", sort: "updated", limit: 100 }]);
      await page.locator('button[aria-label="Notifications"]:visible').click();
      await expect(page.getByText("No updates here yet", { exact: true })).toBeVisible();
      const before = state.calls.filter(c => c.method === "notifications").length;
      await page.evaluate(() => {
        window.dispatchEvent(new Event("echo:appointments-changed"));
        window.dispatchEvent(new Event("echo:notifications-changed"));
      });
      await expect.poll(() => state.calls.filter(c => c.method === "notifications").length).toBe(before + 1);
      expect(state.calls.filter(c => c.method === "memberships")).toHaveLength(1);
      expect(state.calls.filter(c => c.method === "caseDetail")).toHaveLength(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    });
    test("an expired gate blocks revoked membership before another screen can load case metadata", async ({ page }) => {
      const state = await fixtures(page);
      await page.clock.install();
      await page.goto("/professional/requests?organization=org-one");
      await expect(page.getByRole("link", { name: "Open case", exact: true })).toBeVisible();
      state.memberships = state.memberships.map(m => ({ ...m, status: "suspended", accessState: "suspended_membership" }));
      const queues = state.calls.filter(c => c.method === "queue").length;
      await page.clock.fastForward(15_001);
      await page.getByRole("navigation", { name: width < 1024 ? "Professional mobile navigation" : "Professional workspace", exact: true }).getByRole("link", { name: "My cases", exact: true }).click();
      await expect(page).toHaveURL(/professional.access/);
      expect(state.calls.filter(c => c.method === "queue")).toHaveLength(queues);
      await expect(page.locator('a[href*="/professional/cases/' + caseId + '"]')).toHaveCount(0);
    });
  });
}

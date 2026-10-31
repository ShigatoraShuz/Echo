import { expect, test } from "@playwright/test";
import { fixtures } from "./fixtures";

for (const width of [390, 1280]) {
  test(`professional Calendar and Resources preserve routing/history at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await fixtures(page);
    state.detail.appointments = [{ id: "fictional-navigation-appointment", startsAt: "2099-10-14T10:00:00Z", endsAt: "2099-10-14T11:00:00Z", mode: "online", locationHint: "Synthetic meeting", status: "proposed" }];
    await page.goto("/professional?organization=org-one");
    await expect(page.getByRole("heading", { name: "Today, at a glance" })).toBeVisible();
    const nav = page.getByRole("navigation", { name: width < 1024 ? "Professional mobile navigation" : "Professional workspace", exact: true });
    await nav.getByRole("link", { name: "Calendar" }).click();
    await expect(page).toHaveURL(/\/professional\/calendar\?organization=org-one$/);
    await expect(page.getByRole("heading", { name: "Calendar", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open case FE000000" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Calendar" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: "Today, at a glance" })).toHaveCount(0);
    if (width < 1024) {
      await page.getByRole("button", { name: "Open workspace menu" }).click();
      await page.getByRole("dialog").getByRole("link", { name: "Resources" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    } else await nav.getByRole("link", { name: "Resources" }).click();
    await expect(page).toHaveURL(/\/professional\/resources\?organization=org-one$/);
    await expect(page.getByRole("heading", { name: "Professional resources" })).toBeVisible();
    await expect(page.getByText(/No reviewed crisis resources/)).toBeVisible();
    await expect(page.locator('a[href="/support/find-help"]')).toHaveCount(0);
    if (width < 1024) {
      await page.getByRole("button", { name: "Open workspace menu" }).click();
      await expect(page.getByRole("dialog").getByRole("link", { name: "Resources" })).toHaveAttribute("aria-current", "page");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: "Open workspace menu" })).toBeFocused();
    } else await expect(nav.getByRole("link", { name: "Resources" })).toHaveAttribute("aria-current", "page");
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Calendar", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Calendar" })).toHaveAttribute("aria-current", "page");
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Today, at a glance" })).toBeVisible();
    await page.goForward();
    await expect(page.getByRole("heading", { name: "Calendar", exact: true })).toBeVisible();
    await page.getByLabel("Active organization").selectOption("org-two");
    await expect(page).toHaveURL(/\/professional\/calendar\?organization=org-two$/);
    await expect(page.getByRole("link", { name: "Open case FE000000" })).toHaveAttribute("href", /organization=org-two$/);
    await nav.getByRole("link", { name: "Requests" }).click();
    await expect(page.getByRole("heading", { name: "Support requests", exact: true })).toBeVisible();
    await nav.getByRole("link", { name: "My cases" }).click();
    await expect(page.getByRole("heading", { name: "My cases", exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("calendar separates an empty schedule from a failed API response", async ({ page }) => {
  const state = await fixtures(page);
  await page.goto("/professional/calendar?organization=org-one");
  await expect(page.getByText("No upcoming appointments", { exact: true })).toBeVisible();
  state.faults.dashboard = { status: 503, code: "SERVER_ERROR" };
  await page.getByRole("button", { name: "Refresh schedule" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByText("No upcoming appointments", { exact: true })).toHaveCount(0);
});

for (const width of [390, 1280]) {
  test(`org_admin sees a scoped Organization Calendar without clinical requests at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await fixtures(page);
    state.memberships = state.memberships.map((membership) => ({ ...membership, role: "org_admin" }));
    state.detail.appointments = [{ id: "private-fixture", startsAt: "2099-10-14T10:00:00Z", endsAt: "2099-10-14T11:00:00Z", mode: "online", locationHint: "Confidential fixture", status: "confirmed" }];
    await page.goto("/professional/calendar?organization=org-one");
    await expect(page.getByRole("heading", { name: "Organization Calendar" })).toBeVisible();
    await expect(page.getByText("Organization-wide scheduling is not available yet")).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.locator("time")).toHaveCount(0);
    const nav = page.getByRole("navigation", { name: width < 1024 ? "Professional mobile navigation" : "Professional workspace", exact: true });
    await expect(nav.getByRole("link", { name: "Calendar" })).toHaveAttribute("aria-current", "page");
    await page.getByLabel("Active organization").selectOption("org-two");
    await expect(page.getByRole("link", { name: "View organization requests" })).toHaveAttribute("href", /organization=org-two$/);
    await page.getByRole("button", { name: "Refresh access" }).click();
    await expect(page.getByRole("heading", { name: "Organization Calendar" })).toBeVisible();
    if (width < 1024) {
      await page.getByRole("button", { name: "Open workspace menu" }).click();
      await page.getByRole("dialog").getByRole("link", { name: "Resources" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    } else await nav.getByRole("link", { name: "Resources" }).click();
    await expect(page.getByRole("heading", { name: "Professional resources" })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/professional\/calendar\?organization=org-two$/);
    await expect(page.getByRole("heading", { name: "Organization Calendar" })).toBeVisible();
    await page.goForward();
    await expect(page.getByRole("heading", { name: "Professional resources" })).toBeVisible();
    expect(state.calls.filter((call) => ["dashboard", "queue", "caseDetail"].includes(call.method))).toEqual([]);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

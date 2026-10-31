import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { caseId, fixtures } from "./fixtures";

for (const width of [320, 375, 390, 430, 768, 1024, 1440, 1690]) {
  test(`settings and notification panel fit ${width}px`, async ({ page }) => {
    const state = await fixtures(page);
    state.notifications = Array.from({ length: 20 }, (_, index) => ({ id: "notification-" + index, kind: index % 2 ? "case_updated" : "appointment_changed", caseId, readAt: null, createdAt: "2026-10-20T08:00:00Z" }));
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/professional/settings?organization=org-one");
    await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("Fictional account holder");
    expect(state.calls.filter(call => call.method === "notifications")).toHaveLength(0);
    await page.locator('button[aria-label="Notifications"]:visible').click();
    const panel = page.getByRole("dialog", { name: "Notifications", exact: true });
    await expect(panel.getByRole("heading", { name: "Appointment updated" })).toHaveCount(10);
    const box = await panel.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width); expect(box!.y + box!.height).toBeLessThanOrEqual(900);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    expect(await panel.locator(".pro-notification-scroll").evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
    expect((await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa"]).analyze()).violations).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(page.locator('button[aria-label="Notifications"]:visible')).toBeFocused();
  });
}

test("notification reads are lazy, acknowledged once, filtered honestly, and never persisted", async ({ page }) => {
  const state = await fixtures(page);
  state.notifications = [{ id: "notice-one", kind: "appointment_changed", caseId, readAt: null, createdAt: "2026-10-20T08:00:00Z" }, { id: "notice-two", kind: "case_updated", caseId, readAt: null, createdAt: "2026-10-19T08:00:00Z" }];
  await page.goto("/professional?organization=org-one");
  await expect(page.getByRole("button", { name: "Accept request", exact: true })).toBeVisible();
  expect(state.calls.filter(call => call.method === "notifications")).toHaveLength(0);
  await page.locator('button[aria-label="Notifications"]:visible').click();
  const panel = page.getByRole("dialog", { name: "Notifications", exact: true });
  await expect(panel.getByText("2 unread", { exact: true })).toBeVisible();
  expect(state.calls.filter(call => call.method === "notifications")).toHaveLength(1);
  await panel.getByRole("button", { name: "Appointments", exact: true }).click();
  await expect(panel.getByRole("heading", { name: "Appointment updated" })).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Case updated" })).toHaveCount(0);
  await panel.getByRole("button", { name: "Mark read", exact: true }).click();
  await expect(panel.getByText("1 unread", { exact: true })).toBeVisible();
  expect(state.calls.filter(call => call.method === "readNotification")).toEqual([{ method: "readNotification", args: ["org-one", "notice-one"] }]);
  await panel.getByRole("button", { name: "Inbox", exact: true }).click();
  await expect(panel.getByRole("heading", { name: "Case updated" })).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Appointment updated" })).toHaveCount(0);
  await panel.getByRole("button", { name: "General", exact: true }).click();
  await expect(panel.getByText("General updates aren’t available yet")).toBeVisible();
  await panel.getByRole("button", { name: "All", exact: true }).click();
  await panel.getByRole("link", { name: "Open case", exact: true }).last().focus();
  await page.keyboard.press("Tab");
  await panel.getByRole("button", { name: "Mark read" }).focus(); await page.keyboard.press("Tab");
  await expect(panel.getByRole("button", { name: "Close notifications" })).toBeFocused();
  await page.mouse.click(10, 250);
  await expect(panel).toHaveCount(0);
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  expect(stored).not.toContain("notice-one"); expect(stored).not.toContain(caseId);
});

test("notification responses and private entries are discarded on organization/account changes", async ({ page }) => {
  const state = await fixtures(page);
  state.notifications = [{ id: "old-scope-notice", kind: "case_updated", caseId, readAt: null, createdAt: "2026-10-20T08:00:00Z" }];
  let release!: () => void;
  state.notificationsByOrganization = { "org-one": [...state.notifications], "org-two": [] };
  state.holds["notifications:org-one"] = new Promise<void>(resolve => { release = resolve; });
  await page.goto("/professional?organization=org-one");
  await page.locator('button[aria-label="Notifications"]:visible').click();
  await expect.poll(() => state.calls.filter(call => call.method === "notifications").length).toBe(1);
  // A modal prevents ordinary outside interaction; simulate an external route/
  // organization change while its old request is still in flight.
  await page.getByLabel("Active organization").selectOption("org-two", { force: true });
  await expect(page).toHaveURL(/organization=org-two/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  release(); delete state.holds["notifications:org-one"];
  await page.locator('button[aria-label="Notifications"]:visible').click();
  await expect(page.getByRole("dialog").getByText("No updates here yet")).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("echo:sensitive-state-cleared")));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("No updates here yet")).toHaveCount(0);
});

test("administrators receive neither clinical notifications nor a personal clinical caseload", async ({ page }) => {
  const state = await fixtures(page); state.memberships.forEach(item => { item.role = "org_admin"; });
  await page.goto("/professional/my-cases?organization=org-one");
  await expect(page.getByRole("heading", { name: "A workspace for your role" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open case", exact: true })).toHaveCount(0);
  await page.locator('button[aria-label="Notifications"]:visible').click();
  await expect(page.getByText("No administrative notification source yet")).toBeVisible();
  expect(state.calls.filter(call => ["notifications", "caseDetail", "queue"].includes(call.method))).toEqual([]);
});

test("professional settings only update supported personal fields and keep verified identity read-only", async ({ page }) => {
  const state = await fixtures(page);
  await page.goto("/professional/settings?organization=org-one");
  await page.getByLabel("Display name", { exact: true }).fill("Updated fictional name");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByText("Profile saved.", { exact: true })).toBeVisible();
  expect(state.calls.filter(call => call.method === "updateProfile")).toEqual([{ method: "updateProfile", args: [{ displayName: "Updated fictional name", timezone: "Asia/Manila", themeVariant: "echo-calm", themeMode: "light" }] }]);
  const sections = page.getByRole("navigation", { name: "Settings sections" });
  await sections.getByRole("button", { name: "Organization", exact: true }).click();
  await expect(page.getByText("Synthetic credential", { exact: true })).toBeVisible();
  await expect(page.locator("main input")).toHaveCount(0);
  await sections.getByRole("button", { name: "Notifications", exact: true }).click();
  await page.getByRole("checkbox", { name: "Enabled", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Enabled", exact: true })).not.toBeChecked();
  await expect(page.getByText("Notification preference saved.")).toBeVisible();
  expect(state.notificationSettings.inAppEnabled).toBe(false); expect(state.notificationSettings.emailEnabled).toBe(false);
  await sections.getByRole("button", { name: "Appearance", exact: true }).click();
  await page.getByLabel("Color mode", { exact: true }).selectOption("dark");
  await expect(page.getByText("Appearance saved.")).toBeVisible();
  expect(state.profile.themeMode).toBe("dark");
  await sections.getByRole("button", { name: "Privacy & security", exact: true }).click();
  await expect(page.getByRole("link", { name: "Open security settings" })).toHaveAttribute("href", "/settings/security");
  expect(state.calls.filter(call => call.method === "settings")).toHaveLength(1);
  expect(state.calls.filter(call => call.method === "memberships")).toHaveLength(1);
  await sections.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByRole("button", { name: "Sign out of ECHO", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("/professional/login$"));
  await expect(page.getByLabel("Display name", { exact: true })).toHaveCount(0);
});

test("notification permission failures conceal entries and settings failure cannot display old account fields", async ({ page }) => {
  const state = await fixtures(page);
  state.faults.notifications = { status: 403, code: "AUTHORIZATION_ERROR" };
  await page.goto("/professional?organization=org-one");
  await page.locator('button[aria-label="Notifications"]:visible').click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Open case", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape"); state.faults.settings = { status: 401, code: "AUTHENTICATION_ERROR" };
  await page.goto("/professional/settings?organization=org-one");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Display name", { exact: true })).toHaveCount(0);
});

for (const width of [390, 1690]) {
  test(`resource directory retains safety, facts and natural scrolling at ${width}px`, async ({ page }) => {
    const state = await fixtures(page);
    state.resources = Array.from({ length: 12 }, (_, index) => ({ id: "fictional-resource-" + index, type: "crisis_hotline", countryCode: "PH", regionCode: null, name: "Fictional resource " + (index + 1), organizationName: "Fictional support organization", description: "Synthetic resource for local layout QA only. This is not a real service.", availability: "Fictional availability; access may vary. Not a real service.", phoneNumber: null, smsNumber: null, websiteUrl: "https://example.invalid/service", verificationSource: "https://example.invalid/review", lastVerifiedAt: "2026-01-01T00:00:00Z" }));
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/professional/resources?organization=org-one");
    await expect(page.getByRole("heading", { name: "Fictional resource 12", exact: true })).toBeVisible();
    await expect(page.getByText(/ECHO is not an emergency service/)).toBeVisible();
    await expect(page.getByText(/No professional escalation or dispatch service is connected/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(900);
    expect(await page.getByText(/Published availability:/).count()).toBe(12);
    await page.getByRole("heading", { name: "Fictional resource 12", exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("heading", { name: "Fictional resource 12", exact: true })).toBeVisible();
  });
}

for (const code of ["MFA_REQUIRED", "RESOURCE_FORBIDDEN"]) {
  test(`notification access loss ${code} clears an already-open clinical case`, async ({ page }) => {
    const state = await fixtures(page);
    await page.goto("/professional/cases/" + caseId + "?organization=org-one");
    await page.getByText("Fictional journal title", { exact: true }).click();
    await expect(page.getByText("Fictional shared snapshot", { exact: true })).toBeVisible();
    state.faults.notifications = { status: 403, code };
    await page.locator('button[aria-label="Notifications"]:visible').click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByText("Fictional shared snapshot", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("New case note")).toHaveCount(0);
  });
}

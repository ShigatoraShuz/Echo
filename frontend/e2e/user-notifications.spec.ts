import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { appointmentNotificationTypes } from "@echo/contracts";

async function fixture(page: Page) {
  let fail = false;
  const calls: { method: string; args: unknown[] }[] = [];
  const items = Array.from({ length: 28 }, (_, i) => ({
    id: `aa000000-0000-4000-8000-${String(i).padStart(12,"0")}`,
    type: i < 25 ? "verification_status" : appointmentNotificationTypes[i - 25],
    title: i < 25 ? `Account update ${i + 1}` : ["Appointment response needed", "Appointment updated", "Appointment completed"][i - 25],
    message: i < 25 ? "Your fictional account update is ready to review." : "Open your support workspace to review this fictional appointment update.",
    resourceType: i < 25 ? "identity_verification" : "professional_case", resourceId: "fictional-request", resourceLabel: null,
    createdAt: new Date(Date.UTC(2026,9,25,10,0,0)-i*60_000).toISOString(), readAt: null as string | null,
  }));
  await page.route("**/*", async route => {
    if (new URL(route.request().url()).hostname !== "127.0.0.1") return route.abort();
    if (!route.request().url().endsWith("/__fixtures/rpc")) return route.continue();
    const { method, args } = route.request().postDataJSON(); calls.push({ method, args });
    if (fail && method === "userNotifications") return route.fulfill({ status: 503, json: { code: "DATABASE_UNAVAILABLE" } });
    let result: unknown;
    if (method === "userNotifications") {
      const [status, limit, options = {}] = args as [string, number, { category?: string; before?: string }];
      const selected = items.filter(item => (status !== "unread" || !item.readAt) && (options.category === "appointments" ? appointmentNotificationTypes.includes(item.type as typeof appointmentNotificationTypes[number]) : options.category !== "general" || !appointmentNotificationTypes.includes(item.type as typeof appointmentNotificationTypes[number])));
      const offset = options.before ? selected.findIndex(item => item.id === options.before!.split("~")[1]) + 1 : 0;
      const slice = selected.slice(offset, offset + limit);
      result = { notifications: slice, unreadCount: items.filter(item => !item.readAt).length, nextCursor: selected.length > offset + limit ? `${slice.at(-1)!.createdAt}~${slice.at(-1)!.id}` : null };
    } else if (method === "userNotificationRead") {
      const item = items.find(item => item.id === args[0])!; item.readAt ??= new Date().toISOString(); result = { notification: item };
    } else if (method === "userNotificationsReadAll") {
      items.forEach(item => { item.readAt ??= new Date().toISOString(); }); result = { notifications: items.slice(0,20), unreadCount: 0 };
    } else if (method === "settings") result = { notifications: { inAppEnabled: true } };
    else return route.fulfill({ status: 400, json: { code: "UNEXPECTED_FIXTURE_CALL" } });
    return route.fulfill({ json: result });
  });
  return { calls, setFailure: (value: boolean) => { fail = value; } };
}

for (const width of [390,1440]) for (const dark of [false,true]) test(`anchored panel, tabs and read flow at ${width}px ${dark ? "dark" : "light"}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ colorScheme: dark ? "dark" : "light" });
  const state = await fixture(page);
  await page.goto("/__qa/user-notifications");
  if (dark) await page.evaluate(() => document.documentElement.classList.add("dark"));
  const bell = page.getByRole("button", { name: "Notifications, 28 unread" });
  await bell.click();
  const panel = page.getByRole("dialog", { name: "Notifications", exact: true });
  await expect(panel).toBeVisible();
  const rect = (await panel.boundingBox())!, trigger = (await bell.boundingBox())!;
  expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.x+rect.width).toBeLessThanOrEqual(width);
  expect(rect.y+rect.height).toBeLessThanOrEqual(901);
  if (width > 640) { expect(rect.y).toBeCloseTo(trigger.y+trigger.height+12,0); expect(rect.x+rect.width).toBeCloseTo(trigger.x+trigger.width,0); }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole("combobox")).toHaveCount(0);
  await page.getByRole("tab", { name: "Appointments", exact: true }).click();
  await expect(page.getByText("Appointment response needed", { exact: true })).toBeVisible();
  await expect(panel.getByRole("listitem")).toHaveCount(3);
  expect(state.calls.some(call => call.method === "userNotifications" && (call.args[2] as { category?: string })?.category === "appointments")).toBe(true);
  await page.screenshot({ path: `../artifacts/user-notifications/panel-${width}-${dark ? "dark" : "light"}.png`, fullPage: true });
  const axe = await new AxeBuilder({ page }).include(".user-notification-panel").withTags(["wcag2a","wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);
  await page.getByRole("tab", { name: "General", exact: true }).click();
  await page.getByRole("button", { name: "Load more updates" }).click();
  await expect(panel.getByRole("listitem")).toHaveCount(25);
  await page.getByRole("tab", { name: "Inbox", exact: true }).click();
  await page.getByRole("button", { name: "Mark all read" }).click();
  await expect(page.getByText(/all caught up/)).toBeVisible();
  await expect(page.getByText("0 unread notifications", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape"); await expect(panel).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Notifications", exact: true })).toBeFocused();
});

test("failure/retry, focus trap, keyboard tabs, navigation and backdrop dismissal", async ({ page }) => {
  await page.setViewportSize({ width:1440,height:900 });
  const state = await fixture(page); state.setFailure(true);
  await page.goto("/__qa/user-notifications");
  const bell = page.getByRole("button", { name: "Notifications", exact: true });
  await expect(bell).toBeEnabled(); await bell.click();
  await expect(page.getByRole("alert")).toBeVisible();
  state.setFailure(false); await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByText("28 unread notifications")).toBeVisible();
  await page.getByRole("tab", { name: "All", exact: true }).focus();
  await page.keyboard.press("End"); await expect(page.getByRole("tab", { name: "Appointments", selected:true })).toBeFocused();
  await page.keyboard.press("Home"); await expect(page.getByRole("tab", { name: "All", selected:true })).toBeFocused();
  await expect(page.getByRole("tabpanel")).toHaveAttribute("aria-busy", "false");
  await page.getByRole("button", { name: "Refresh notifications" }).focus(); await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Close notifications" })).toBeFocused();
  await page.getByRole("link", { name: /Account update 1\b/ }).click();
  await expect(page).toHaveURL(/\/settings\/verification$/); await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: /Notifications, 27 unread/ }).click();
  await page.mouse.click(20,300); await expect(page.getByRole("dialog")).toHaveCount(0);
});

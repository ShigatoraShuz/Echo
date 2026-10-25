import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixtures, caseId } from "./fixtures";
for (const width of [390, 1440])
  for (const dark of [false, true])
    test(
      "case tabs, protected drafts and atomic reschedule " + width + " " + (dark ? "dark" : "light"),
      async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        const state = await fixtures(page);
        state.detail.appointments = [
          {
            id: "old",
            startsAt: "2099-10-24T10:00:00Z",
            endsAt: "2099-10-24T11:00:00Z",
            mode: "online",
            locationHint: "Fictional test meeting",
            status: "confirmed",
          },
        ];
        await page.goto("/professional/cases/" + caseId + "?organization=org-one");
        await expect(page.getByRole("tab", { name: "Overview", exact: true })).toBeVisible();
        if (dark) await page.evaluate(() => document.documentElement.classList.add("dark"));
        await page.getByRole("tab", { name: "Notes and care coordination" }).click();
        await page.getByLabel("New case note").fill("Fictional unsaved draft");
        await page.getByRole("tab", { name: "Appointments", exact: true }).click();
        await page.getByRole("tab", { name: "Notes and care coordination" }).click();
        await expect(page.getByLabel("New case note")).toHaveValue("Fictional unsaved draft");
        await page.getByLabel("New case note").fill("");
        await page.getByRole("tab", { name: "Overview", exact: true }).focus();
        await page.keyboard.press("End");
        await expect(page.getByRole("tab", { name: "History", exact: true })).toBeFocused();
        await page.getByRole("tab", { name: "Appointments", exact: true }).click();
        await page.getByRole("button", { name: "Reschedule appointment", exact: true }).click();
        await expect(page.getByRole("dialog")).toHaveCount(1);
        await page.getByLabel("Starts", { exact: true }).fill("2099-10-25T10:00");
        await page.getByLabel("Ends", { exact: true }).fill("2099-10-25T11:00");
        await page.getByRole("button", { name: "Review appointment proposal" }).click();
        await expect(page.getByRole("dialog")).toHaveCount(1);
        await expect(page.getByText(/previous appointment will be canceled atomically/)).toBeVisible();
        const scan = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
        expect(scan.violations).toEqual([]);
        await page.getByRole("button", { name: "Send proposal", exact: true }).click();
        await expect(page.getByText(/Replacement proposal recorded/)).toBeVisible();
        expect(state.calls.filter((call) => call.method === "rescheduleAppointment")).toHaveLength(1);
        expect(state.calls.filter((call) => call.method === "cancelAppointment")).toHaveLength(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({
          path: "../artifacts/professional-integration/case-" + width + "-" + (dark ? "dark" : "light") + ".png",
          fullPage: true,
        });
      },
    );
test("professional discovery stays active with the panel closed and audio only plays after explicit gesture", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let starts = 0;
    Object.defineProperty(window, "__soundStarts", { get: () => starts });
    class FakeAudio {
      state = "running";
      currentTime = 0;
      destination = {};
      resume() {
        return Promise.resolve();
      }
      close() {
        return Promise.resolve();
      }
      createOscillator() {
        return {
          type: "sine",
          frequency: { value: 0 },
          connect() {},
          start() {
            starts++;
          },
          stop() {},
        };
      }
      createGain() {
        return {
          gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
          connect() {},
        };
      }
    }
    Object.defineProperty(window, "AudioContext", { value: FakeAudio });
  });
  const state = await fixtures(page);
  state.notifications = [
    { id: "old", kind: "appointment_changed", caseId, readAt: null, createdAt: "2026-01-01T10:00:00Z" },
  ];
  await page.goto("/professional/settings?organization=org-one");
  await page.getByRole("button", { name: "Notifications", exact: true }).click();
  await expect(page.getByLabel("Notification sounds")).not.toBeChecked();
  await page.getByLabel("Notification sounds").check();
  await expect(page.getByRole("status")).toContainText("Sound preference saved");
  expect(await page.evaluate(() => (window as unknown as Window & { __soundStarts: number }).__soundStarts)).toBe(2);
  state.notifications.push({
    id: "new",
    kind: "appointment_changed",
    caseId,
    readAt: null,
    createdAt: new Date(Date.now() + 1000).toISOString(),
  });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(() => page.evaluate(() => (window as unknown as Window & { __soundStarts: number }).__soundStarts)).toBe(4);
  await page.getByRole("button", { name: /Notifications,.*unread/ }).click();
  await expect(page.getByRole("dialog", { name: "Notifications" })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as Window & { __soundStarts: number }).__soundStarts)).toBe(4);
});

/** Mocked browser QA only; persistence/auth evidence lives in separate integration suites. */
import { expect, test } from "@playwright/test";
import { caseId, fixtures } from "./fixtures";

for (const width of [390, 1440]) {
  test(`owner messaging at ${width}px refreshes replies/status and uses the existing retry ID`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    const state = await fixtures(page);
    await page.goto("/professional-support/messages");
    const draft = page.getByRole("textbox", { name: "Message your practitioner" });
    await expect(draft).toBeVisible();
    await draft.fill("Fictional browser owner reply");
    state.faults.sendMessage = { status: 503, code: "SERVER_ERROR" };
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    delete state.faults.sendMessage;
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText("Fictional browser owner reply", { exact: true })).toBeVisible();
    const sends = state.calls.filter(call => call.method === "sendMessage");
    expect(sends).toHaveLength(2); expect(sends[1].args).toEqual(sends[0].args);
    state.messagePages.latest = { messages: [{ id: "incoming-reply", requestId: caseId, sender: "professional", body: "Fictional incoming professional reply", createdAt: "2026-10-15T08:00:00Z" }], nextCursor: null };
    state.detail.request.status = "closed";
    await page.getByRole("button", { name: "Refresh conversation" }).click();
    await expect(page.getByText("Fictional incoming professional reply", { exact: true })).toBeVisible();
    await expect(page.getByText("This case is read-only. You can still review its history.")).toBeVisible();
    await expect(draft).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("owner thread rejects wrong-case responses before acknowledging or displaying them", async ({ page }) => {
  const state = await fixtures(page);
  state.messagePages.latest = { messages: [{ id: "wrong", requestId: "other-case", sender: "professional", body: "Wrong-case browser fixture", createdAt: "2026-10-15T08:00:00Z" }], nextCursor: null };
  await page.goto("/professional-support/messages");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByText("Wrong-case browser fixture", { exact: true })).toHaveCount(0);
  expect(state.calls.some(call => call.method === "markMessagesRead")).toBe(false);
});

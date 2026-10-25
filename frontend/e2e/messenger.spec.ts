import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { caseId, fixtures } from "./fixtures";
function hold() { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; }
const counts = (state: Awaited<ReturnType<typeof fixtures>>, method: string) => state.calls.filter(call => call.method === method);
async function openThread(page: Page) { await page.getByRole("button", { name: "Messages", exact: true }).click(); await page.getByRole("button", { name: /Case FE000000/ }).click(); }
async function ready(page: Page) { await expect(page.getByRole("link", { name: "Open case", exact: true })).toBeVisible(); }

test.describe("Professional Messenger authorization and lifecycle", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });
  test("lazy metadata only; selected conversation, read acknowledgement, confirmed reply and no duplicates", async ({ page }) => {
    const state = await fixtures(page); state.detail.messagingAvailable = true;
    await page.goto("/professional?organization=org-one"); await ready(page);
    expect(counts(state, "queue")).toHaveLength(1); expect(counts(state, "caseMessages")).toHaveLength(0);
    await page.getByRole("button", { name: "Messages", exact: true }).click();
    await expect(page.getByRole("button", { name: /Case FE000000/ })).toHaveCount(1);
    expect(counts(state, "queue")).toHaveLength(2); expect(counts(state, "caseDetail")).toHaveLength(0);
    expect(counts(state, "caseMessages")).toHaveLength(0);
    await page.getByLabel("Search case conversations").fill("missing"); await expect(page.getByText("No matching cases", { exact: true })).toBeVisible();
    await page.getByLabel("Search case conversations").fill(""); await page.getByRole("button", { name: /Case FE000000/ }).click();
    await expect(page.getByLabel("Message this case")).toBeVisible(); expect(counts(state, "caseDetail")).toHaveLength(1); expect(counts(state, "caseMessages")).toHaveLength(1); expect(counts(state, "markCaseMessagesRead")).toHaveLength(1);
    await expect(page.getByText("Fictional shared snapshot", { exact: true })).toHaveCount(0);
    const delayed = hold(); state.holds.sendCaseMessage = delayed.promise;
    await page.getByLabel("Message this case").fill("Synthetic authorized reply");
    await page.getByRole("button", { name: "Send", exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
    await expect(page.getByRole("button", { name: "Sending…" })).toBeDisabled(); expect(counts(state, "sendCaseMessage")).toHaveLength(1);
    await expect(page.locator(".pro-message-bubble").filter({ hasText: "Synthetic authorized reply" })).toHaveCount(0);
    delayed.release(); await expect(page.locator(".pro-message-bubble").filter({ hasText: "Synthetic authorized reply" })).toHaveCount(1);
    await expect(page.getByLabel("Message this case")).toHaveValue("");
    expect(counts(state, "caseMessages")).toHaveLength(1);
    await page.keyboard.press("Escape"); await expect(page.getByRole("dialog", { name: "Messages", exact: true })).toHaveCount(0); await expect(page.getByRole("button", { name: "Messages", exact: true })).toBeFocused();
  });
  test("an uncertain send retries the same idempotency key", async ({ page }) => {
    const state = await fixtures(page); state.detail.messagingAvailable = true;
    await page.goto("/professional?organization=org-one"); await openThread(page);
    await page.getByLabel("Message this case").fill("One intent, one idempotency key"); state.faults.sendCaseMessage = { status: 500, code: "SERVER_ERROR" };
    await page.getByRole("button", { name: "Send", exact: true }).click(); await expect(page.getByLabel("Message this case")).toBeDisabled();
    delete state.faults.sendCaseMessage; await page.getByRole("button", { name: "Retry same message", exact: true }).click(); await expect(page.getByLabel("Message this case")).toHaveValue("");
    const attempts = counts(state, "sendCaseMessage"); expect(attempts).toHaveLength(2); expect(attempts[0].args).toEqual(attempts[1].args);
  });
  test("older cursor pages deduplicate and preserve the selected case", async ({ page }) => {
    const state = await fixtures(page); state.detail.messagingAvailable = true;
    const message = { id: "latest", requestId: caseId, sender: "user" as const, body: "Latest synthetic message", createdAt: "2026-10-20T08:00:00Z" };
    state.messagePages.latest = { messages: [message], nextCursor: "older-cursor" }; state.messagePages["older-cursor"] = { messages: [{ ...message, id: "older", body: "Older synthetic message" }, message], nextCursor: null };
    await page.goto("/professional?organization=org-one"); await openThread(page); await page.getByRole("button", { name: "Load older messages", exact: true }).click();
    await expect(page.getByText("Older synthetic message", { exact: true })).toBeVisible(); await expect(page.getByText("Latest synthetic message", { exact: true })).toHaveCount(1);
    expect(counts(state, "caseMessages")[1].args).toEqual([caseId, "older-cursor"]); expect(counts(state, "markCaseMessagesRead")).toHaveLength(1);
  });
  for (const restricted of ["closed", "revoked", "unsupported"] as const) test(restricted + " case keeps sending unavailable", async ({ page }) => {
    const state = await fixtures(page); state.detail.messagingAvailable = restricted !== "unsupported";
    if (restricted === "closed") state.detail.request.status = "closed";
    if (restricted === "revoked") state.detail.request.sharingActive = false;
    await page.goto("/professional?organization=org-one"); await openThread(page);
    await expect(page.getByText(restricted === "unsupported" ? "Messaging isn’t available for this case" : "Read-only conversation", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Message this case")).toHaveCount(0); expect(counts(state, "sendCaseMessage")).toHaveLength(0);
    if (restricted === "unsupported") expect(counts(state, "caseMessages")).toHaveLength(0);
  });
  test("org_admin never fetches a clinical list or transcript", async ({ page }) => {
    const state = await fixtures(page); state.memberships = state.memberships.map(item => ({ ...item, role: "org_admin" }));
    await page.goto("/professional/calendar?organization=org-one"); await page.getByRole("button", { name: "Messages", exact: true }).click();
    await expect(page.getByText("Conversations stay with the care team", { exact: true })).toBeVisible();
    for (const method of ["queue", "caseDetail", "caseMessages", "markCaseMessagesRead"]) expect(counts(state, method)).toHaveLength(0);
  });
  test("no assigned cases gives an honest empty state", async ({ page }) => {
    const state = await fixtures(page); state.emptyQueue = true;
    await page.goto("/professional?organization=org-one"); await page.getByRole("button", { name: "Messages", exact: true }).click();
    await expect(page.getByText("A quieter inbox", { exact: true })).toBeVisible(); expect(counts(state, "caseDetail")).toHaveLength(0);
  });
  test("mismatched organization is concealed before any transcript request", async ({ page }) => {
    const state = await fixtures(page); state.detail.messagingAvailable = true; state.detail.request.organizationId = "org-two";
    await page.goto("/professional?organization=org-one"); await openThread(page);
    await expect(page.getByRole("heading", { name: "Access is not available", exact: true })).toBeVisible();
    expect(counts(state, "caseMessages")).toHaveLength(0); await expect(page.getByRole("dialog")).toHaveCount(0);
  });
  test("late conversation responses cannot survive switching organizations", async ({ page }) => {
    const state = await fixtures(page); state.detail.messagingAvailable = true; const delayed = hold(); state.holds.caseMessages = delayed.promise;
    await page.goto("/professional?organization=org-one"); await openThread(page); await expect.poll(() => counts(state, "caseMessages").length).toBe(1);
    await page.getByRole("button", { name: "Close messages", exact: true }).click(); await page.getByLabel("Active organization").selectOption("org-two");
    delayed.release(); await ready(page); await page.getByRole("button", { name: "Messages", exact: true }).click();
    await expect(page.getByRole("button", { name: /Case FE000000/ })).toBeVisible();
    await expect(page.getByText("Fictional private conversation", { exact: true })).toHaveCount(0); expect(counts(state, "markCaseMessagesRead")).toHaveLength(0);
    await page.getByRole("button", { name: "Close messages", exact: true }).click(); await page.getByLabel("Active organization").selectOption("org-one"); await openThread(page); await expect(page.getByLabel("Message this case")).toHaveValue("");
  });
  for (const code of ["MFA_REQUIRED", "AUTHENTICATION_ERROR", "AUTHORIZATION_ERROR"]) test(code + " during sending conceals conversation and workspace", async ({ page }) => {
    const state = await fixtures(page); state.detail.messagingAvailable = true;
    await page.goto("/professional?organization=org-one"); await openThread(page); await page.getByLabel("Message this case").fill("Synthetic private draft");
    state.faults.sendCaseMessage = { status: code === "AUTHENTICATION_ERROR" ? 401 : 403, code };
    await page.getByRole("button", { name: "Send", exact: true }).click(); await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Fictional private conversation", { exact: true })).toHaveCount(0); await expect(page.getByRole("link", { name: "Open case", exact: true })).toHaveCount(0);
  });
  test("closing while drawer code loads never starts a background inbox request", async ({ page }) => {
    const state = await fixtures(page); const delayed = hold();
    await page.route("**/professional-message-drawer.tsx*", async route => { await delayed.promise; await route.continue(); });
    await page.goto("/professional?organization=org-one"); await ready(page);
    await page.getByRole("button", { name: "Messages", exact: true }).click(); await expect(page.getByRole("status", { name: "Opening messages", exact: true })).toBeVisible();
    expect(await page.locator(".professional-portal").evaluate(node => (node as HTMLElement).inert)).toBe(true);
    await page.keyboard.press("Escape"); await expect(page.getByRole("button", { name: "Messages", exact: true })).toBeFocused();
    const codeLoaded = page.waitForResponse(response => response.url().includes("professional-message-drawer.tsx")); delayed.release(); await codeLoaded;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(counts(state, "queue")).toHaveLength(1); await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Messages", exact: true }).click(); await expect(page.getByRole("button", { name: /Case FE000000/ })).toBeVisible(); expect(counts(state, "queue")).toHaveLength(2);
  });
  test("pointer entry animates, keyboard and reduced-motion entry remain immediate", async ({ page }) => {
    await fixtures(page); await page.emulateMedia({ reducedMotion: "no-preference" }); await page.goto("/professional?organization=org-one");
    await page.getByRole("button", { name: "Messages", exact: true }).click(); await expect(page.getByRole("button", { name: /Case FE000000/ })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Messages", exact: true })).toHaveCSS("animation-name", "pro-message-enter");
    await page.keyboard.press("Escape"); await page.getByRole("button", { name: "Messages", exact: true }).focus(); await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Messages", exact: true })).toHaveCSS("animation-name", "none");
    await page.keyboard.press("Escape"); await page.emulateMedia({ reducedMotion: "reduce" }); await page.getByRole("button", { name: "Messages", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Messages", exact: true })).toHaveCSS("animation-name", "none");
  });
  test("a late eligibility response after closing cannot fetch or acknowledge a transcript", async ({ page }) => {
    const state = await fixtures(page); state.detail.messagingAvailable = true; const delayed = hold(); state.holds.caseDetail = delayed.promise;
    await page.goto("/professional?organization=org-one"); await openThread(page); await expect.poll(() => counts(state, "caseDetail").length).toBe(1);
    await page.getByRole("button", { name: "Close messages", exact: true }).click(); delayed.release();
    await page.getByRole("button", { name: "Messages", exact: true }).click(); await expect(page.getByRole("button", { name: /Case FE000000/ })).toBeVisible();
    expect(counts(state, "caseMessages")).toHaveLength(0); expect(counts(state, "markCaseMessagesRead")).toHaveLength(0);
  });
  test("hidden tabs discard the conversation and draft", async ({ page }) => {
    const state = await fixtures(page); state.detail.messagingAvailable = true;
    await page.goto("/professional?organization=org-one"); await openThread(page); await page.getByLabel("Message this case").fill("Private tab-local draft");
    await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
    await expect(page.getByRole("dialog")).toHaveCount(0); await expect(page.getByText("Fictional private conversation", { exact: true })).toHaveCount(0);
  });
  test("unavailable messaging endpoints expose no conversation or composer", async ({ page }) => {
    const state = await fixtures(page); state.detail.messagingAvailable = true; state.faults.caseMessages = { status: 404, code: "NOT_FOUND" };
    await page.goto("/professional?organization=org-one"); await openThread(page);
    await expect(page.getByRole("heading", { name: "Conversation unavailable", exact: true })).toBeVisible(); await expect(page.getByLabel("Message this case")).toHaveCount(0); expect(counts(state, "markCaseMessagesRead")).toHaveLength(0);
  });
  test("account invalidation clears drafts; close releases scroll and restores focus", async ({ page }) => {
    const state = await fixtures(page); state.detail.messagingAvailable = true;
    await page.goto("/professional?organization=org-one"); await openThread(page); await page.getByLabel("Message this case").fill("Private local draft");
    await page.keyboard.press("Escape"); await expect(page.getByRole("button", { name: "Messages", exact: true })).toBeFocused(); expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
    await openThread(page); await expect(page.getByLabel("Message this case")).toHaveValue("");
    await page.evaluate(() => window.dispatchEvent(new Event("echo:sensitive-state-cleared"))); await expect(page.getByRole("dialog")).toHaveCount(0); await expect(page.getByLabel("Message this case")).toHaveCount(0);
  });
});

for (const width of [320, 375, 390, 430, 768, 1024, 1440, 1690]) test(width + "px portal pages and full-height Messages fit and remain navigable", async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 }); const state = await fixtures(page); state.detail.messagingAvailable = true;
  for (const route of ["", "/requests", "/my-cases", "/calendar", "/resources", "/settings"]) {
    await page.goto("/professional" + route + "?organization=org-one"); await expect(page.getByLabel("Active organization")).toBeVisible();
    await expect(page.locator("main h1")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.getByRole("button", { name: "Messages", exact: true }).count()).toBe(1);
  }
  await openThread(page); await expect(page.getByLabel("Message this case")).toBeVisible();
  if ([390, 1440].includes(width)) expect((await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa"]).analyze()).violations).toEqual([]);
  const box = await page.getByRole("dialog", { name: "Messages", exact: true }).boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.width).toBeLessThanOrEqual(width); expect(box!.height).toBe(1000);
  if (width >= 768) expect(box!.width).toBe(420); else expect(box!.width).toBe(width < 640 ? width : 420);
  await page.getByLabel("Message this case").fill("Keyboard focus test");
  const send = page.getByRole("button", { name: "Send", exact: true }); await send.focus(); await page.keyboard.press("Tab"); await page.keyboard.press("Tab"); await expect(page.getByRole("button", { name: "Close messages", exact: true })).toBeFocused();
  await page.keyboard.press("Escape"); await expect(page.getByRole("button", { name: "Messages", exact: true })).toBeFocused();
});

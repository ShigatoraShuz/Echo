import { expect, test } from "@playwright/test";
import { caseId, fixtures } from "./fixtures";

function pending() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

test("login validates locally and never grants professional access", async ({ page }) => {
  const state = await fixtures(page);
  await page.goto("/professional/login");
  await page.getByRole("button", { name: "Password", exact: true }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Email address" })).toBeFocused();
  expect(state.calls.some((call) => call.method === "login")).toBe(false);
  await expect(page.getByText(/Professional access still requires approved membership/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Personal sign in" })).toHaveAttribute("href", "/login");
});

for (const [accessState, label] of [["pending_membership", "Professional approval pending"], ["suspended_membership", "Professional access suspended"], ["credential_expired", "Credential renewal required"]]) {
  test(`${accessState} cannot open a case`, async ({ page }) => {
    const state = await fixtures(page);
    state.memberships = [{ ...state.memberships[0], accessState }];
    await page.goto(`/professional/cases/${caseId}`);
    await expect(page).toHaveURL(/\/professional\/access/);
    await expect(page.getByText(label, { exact: true })).toBeVisible();
    expect(state.calls.some((call) => call.method === "caseDetail")).toBe(false);
    await expect(page.getByText("Fictional shared message for browser tests")).toHaveCount(0);
  });
}

test("MFA gate requires verification and a fresh membership response", async ({ page }) => {
  const state = await fixtures(page); state.mfaRequired = true;
  await page.goto("/professional");
  await expect(page.getByRole("heading", { name: "Verify your authenticator" })).toBeVisible();
  expect(state.calls.some((call) => call.method === "queue")).toBe(false);
  await page.getByLabel("Authenticator code").fill("123456");
  const hold = pending(); state.holds.verifyMfa = hold.promise;
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(page.getByRole("button", { name: "Verifying" })).toBeDisabled();
  state.mfaRequired = false; hold.release();
  await expect(page.getByRole("heading", { name: "Choose an organization" })).toBeVisible();
  expect(state.calls.filter((call) => call.method === "verifyMfa")).toHaveLength(1);
});

test("one approved organization enters its scoped workspace", async ({ page }) => {
  const state = await fixtures(page); state.memberships = [state.memberships[0]];
  await page.goto("/professional/access");
  await expect(page).toHaveURL(/\/professional\?organization=org-one/);
  await expect(page.getByLabel("Active organization")).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Request queue" })).toBeVisible();
});

test("organization choice and switching replace scoped links and ignore a late queue", async ({ page }) => {
  const state = await fixtures(page);
  await page.goto("/professional/access");
  await page.getByRole("button", { name: /Fictional org-one.*Enter workspace/ }).click();
  await expect(page.getByLabel("Active organization")).toHaveValue("org-one");
  const hold = pending(); state.holds["queue:org-one"] = hold.promise;
  await page.goto("/professional/requests?organization=org-one");
  await expect(page.getByRole("status", { name: "Loading request queue" })).toBeVisible();
  await page.getByLabel("Active organization").selectOption("org-two");
  await expect(page.getByRole("link", { name: "Open case" })).toHaveAttribute("href", `/professional/cases/${caseId}?organization=org-two`);
  const previousQueue = page.waitForResponse((response) => response.url().endsWith("/__fixtures/rpc") && response.request().postDataJSON().method === "queue" && response.request().postDataJSON().args[0] === "org-one");
  hold.release(); await previousQueue;
  await expect(page.getByLabel("Active organization")).toHaveValue("org-two");
  await expect(page.getByRole("link", { name: "Open case" })).toHaveAttribute("href", `/professional/cases/${caseId}?organization=org-two`);
  await page.getByLabel("Search request ID").fill("no-synthetic-match");
  await expect(page.getByText("No requests match this view.")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByText("2 matching requests from 2 loaded in this organization.")).toBeVisible();
});

test("claim confirmation stays pending until acknowledgment and refreshes counts", async ({ page }) => {
  const state = await fixtures(page); const hold = pending(); state.holds.claim = hold.promise;
  await page.goto("/professional/requests");
  await page.getByRole("button", { name: "Accept request", exact: true }).click();
  expect(state.calls.some((call) => call.method === "claim")).toBe(false);
  await page.getByRole("button", { name: "Confirm acceptance", exact: true }).click();
  await expect(page.getByRole("button", { name: "Confirming acceptance", exact: true })).toBeDisabled();
  expect(state.claimed).toBe(false); hold.release();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Open case" })).toHaveCount(2);
  expect(state.calls.filter((call) => call.method === "claim")).toHaveLength(1);
});

test("claim conflict conceals diagnostic text and requires fresh queue review", async ({ page }) => {
  const state = await fixtures(page); state.faults.claim = { status: 409, code: "CONFLICT" };
  await page.goto("/professional/requests");
  await page.getByRole("button", { name: "Accept request", exact: true }).click();
  await page.getByRole("button", { name: "Confirm acceptance", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByText("Synthetic private diagnostic")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Retry workspace" })).toBeVisible();
  expect(state.claimed).toBe(false);
});

test("My Cases opens only assigned records and revoked sharing clears snapshots", async ({ page }) => {
  const state = await fixtures(page);
  await page.goto("/professional/my-cases");
  await expect(page.getByRole("link", { name: "Open case" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Accept request" })).toHaveCount(0);
  await page.getByRole("link", { name: "Open case" }).click();
  await page.getByText("Fictional journal title", { exact: true }).click();
  await expect(page.getByText("Fictional shared snapshot", { exact: true })).toBeVisible();
  state.detail.request.sharingActive = false;
  const hold = pending(); state.holds.caseDetail = hold.promise;
  await page.getByRole("button", { name: "Refresh case", exact: true }).click();
  await expect(page.getByText("Fictional shared snapshot", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("status", { name: "Loading case details" })).toBeVisible();
  hold.release();
  await expect(page.getByText("Sharing is unavailable", { exact: true })).toBeVisible();
  await expect(page.getByText("Fictional shared message for browser tests")).toHaveCount(0);
});

test("notes and closure show acknowledged success and then enforce read-only state", async ({ page }) => {
  const state = await fixtures(page); const hold = pending(); state.holds.addNote = hold.promise;
  await page.goto(`/professional/cases/${caseId}`);
  await page.getByLabel("New case note").fill("Fictional browser note");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(page.getByRole("button", { name: "Saving", exact: true })).toBeDisabled();
  await expect(page.getByText("Note saved. The server confirmed receipt.")).toHaveCount(0);
  hold.release();
  await expect(page.getByText("Note saved. The server confirmed receipt.")).toBeVisible();
  expect(state.calls.filter((call) => call.method === "addNote")).toHaveLength(1);
  await page.getByRole("button", { name: "Close case", exact: true }).click();
  await page.getByRole("button", { name: "Confirm closure", exact: true }).click();
  await expect(page.getByText("Closure confirmed by the server. Checking the latest case status.")).toBeVisible();
  await expect(page.getByLabel("New case note")).toHaveCount(0);
  expect(state.detail.request.status).toBe("closed");
});

test("appointment proposal, cancellation and referral use their supported workflow", async ({ page }) => {
  const state = await fixtures(page);
  await page.goto(`/professional/cases/${caseId}`);
  await page.getByLabel("Starts", { exact: true }).fill("2099-10-20T10:00");
  await page.getByLabel("Ends", { exact: true }).fill("2099-10-20T11:00");
  await page.getByRole("button", { name: "Review appointment proposal" }).click();
  expect(state.detail.appointments).toHaveLength(0);
  await page.getByRole("button", { name: "Send proposal", exact: true }).click();
  await expect(page.getByText("Appointment proposal recorded. Waiting for the request owner to respond.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Rescheduling unavailable" })).toBeDisabled();
  await page.getByRole("button", { name: "Cancel appointment", exact: true }).click();
  await page.getByRole("button", { name: "Confirm cancellation", exact: true }).click();
  await expect(page.getByText("Appointment cancellation confirmed. Reloading current case status.")).toBeVisible();
  await page.getByLabel("Resource name", { exact: true }).fill("Fictional browser resource");
  await page.getByLabel("Secure website, optional").fill("https://example.invalid/support");
  await page.getByRole("button", { name: "Record referral", exact: true }).click();
  await expect(page.getByText("Referral recorded. No external service was contacted.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Fictional browser resource/ })).toHaveAttribute("rel", "noopener noreferrer");
  expect(state.detail.referrals).toHaveLength(1);
});

for (const [status, code, heading] of [[403, "RESOURCE_FORBIDDEN", "Access is not available"], [404, "NOT_FOUND", "This resource is unavailable"], [429, "RATE_LIMITED", "Please wait before trying again"], [503, "SERVER_ERROR", "Professional service temporarily unavailable"]] as const) {
  test(`${status} on refresh clears protected case content`, async ({ page }) => {
    const state = await fixtures(page);
    await page.goto(`/professional/cases/${caseId}`);
    await expect(page.getByText("Fictional shared message for browser tests")).toBeVisible();
    state.faults.caseDetail = { status, code };
    await page.getByRole("button", { name: "Refresh case", exact: true }).click();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(page.getByText("Fictional shared message for browser tests")).toHaveCount(0);
    await expect(page.getByText("Synthetic private diagnostic")).toHaveCount(0);
    await expect(page.getByLabel("New case note")).toHaveCount(0);
  });
}

test("expired session redirects safely; an empty queue recovers after a service error", async ({ page }) => {
  const state = await fixtures(page); state.faults.memberships = { status: 401, code: "INVALID_ACCESS_TOKEN" };
  await page.goto("/professional/requests?organization=org-one");
  await expect(page.getByRole("heading", { name: "Professional sign in" })).toBeVisible();
  expect(state.calls.some((call) => call.method === "queue")).toBe(false);
  delete state.faults.memberships; state.faults.queue = { status: 503, code: "SERVER_ERROR" };
  await page.goto("/professional/requests");
  await expect(page.getByRole("alert")).toBeVisible();
  delete state.faults.queue; state.emptyQueue = true;
  await page.getByRole("button", { name: "Retry workspace" }).click();
  await expect(page.getByText("No requests in this organization yet.")).toBeVisible();
});

test("a lost network response clears case data and allows an explicit read retry", async ({ page }) => {
  const state = await fixtures(page);
  await page.goto(`/professional/cases/${caseId}`);
  await expect(page.getByText("Fictional shared message for browser tests")).toBeVisible();
  let disconnected = true;
  await page.route("**/__fixtures/rpc", async (route) => {
    if (disconnected && route.request().postDataJSON().method === "caseDetail") return route.abort("internetdisconnected");
    return route.fallback();
  });
  await page.getByRole("button", { name: "Refresh case", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Connection interrupted", exact: true })).toBeVisible();
  await expect(page.getByText("Fictional shared message for browser tests")).toHaveCount(0);
  expect(state.calls.filter((call) => call.method === "addNote")).toHaveLength(0);
  disconnected = false;
  await page.getByRole("button", { name: "Refresh case", exact: true }).click();
  await expect(page.getByText("Fictional shared message for browser tests")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Connection interrupted", exact: true })).toHaveCount(0);
});

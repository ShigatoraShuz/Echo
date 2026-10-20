import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const stateDirectory = process.env.ECHO_STAGING_AUTH_STATE_DIR;
if (!stateDirectory) throw new Error("Set ECHO_STAGING_AUTH_STATE_DIR for protected staging journeys.");
const memberState = path.resolve(stateDirectory, "member.json");
if (!existsSync(memberState)) throw new Error(`Missing disposable member browser state: ${memberState}`);
const routeIdsFile = process.env.ECHO_STAGING_ROUTE_IDS_FILE;
if (!routeIdsFile) throw new Error("Set ECHO_STAGING_ROUTE_IDS_FILE for dynamic route checks.");
const routeIds = JSON.parse(readFileSync(routeIdsFile, "utf8")) as { journalId?: string };

test("mobile settings sections and More reach the intended page", async ({ browser }, testInfo) => {
  test.skip(!["mobile-chrome", "mobile-safari", "narrow-mobile"].includes(testInfo.project.name));
  const context = await browser.newContext({ storageState: memberState });
  try {
    const page = await context.newPage();
    await page.goto("/settings");
    const navigation = page.getByRole("navigation", { name: "Mobile settings sections" });
    await navigation.getByRole("link", { name: "Privacy" }).click();
    await expect(page).toHaveURL(/\/settings\/privacy$/);
    await expect(page.getByRole("heading", { name: "Privacy", exact: true }).last()).toBeVisible();
    await navigation.locator("summary", { hasText: "More" }).click();
    await navigation.getByRole("link", { name: "Security" }).click();
    await expect(page).toHaveURL(/\/settings\/security$/);
    await expect(page.getByRole("heading", { name: "Security", exact: true }).last()).toBeVisible();
  } finally {
    await context.close();
  }
});

test("profile save survives reload after a mocked service failure", async ({ browser }, testInfo) => {
  test.skip(!["desktop-chrome", "mobile-chrome"].includes(testInfo.project.name));
  const context = await browser.newContext({ storageState: memberState });
  try {
    const page = await context.newPage();
    await page.goto("/settings/profile");
    const name = page.getByRole("textbox", { name: "Display name" });
    await expect(name).toBeVisible();
    const updated = `ECHO staging QA ${testInfo.project.name}`;
    await name.fill(updated);
    const pattern = "**/api/v1/settings/profile";
    await page.route(pattern, (route) => route.request().method() === "PATCH"
      ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ success: false, error: { code: "SERVICE_UNAVAILABLE", message: "Temporary QA outage" } }) })
      : route.continue());
    await page.getByRole("button", { name: "Save Profile" }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(name).toHaveValue(updated);
    await page.unroute(pattern);
    await page.getByRole("button", { name: "Save Profile" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Profile updated" }).first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Display name" })).toHaveValue(updated);
  } finally {
    await context.close();
  }
});

test("grounding search, start, pause, resume and history failure", async ({ browser }, testInfo) => {
  test.skip(!["desktop-chrome", "mobile-chrome", "mobile-safari"].includes(testInfo.project.name));
  const context = await browser.newContext({ storageState: memberState });
  try {
    const page = await context.newPage();
    await page.route("**/api/v1/grounding/sessions**", (route) => route.request().method() === "GET" ? route.abort() : route.continue());
    await page.goto("/tools/grounding");
    await expect(page.getByRole("button", { name: "Retry loading history" })).toBeVisible();
    await page.getByPlaceholder("Search exercises").fill("box breathing");
    await page.getByRole("button", { name: "Start Box breathing" }).click();
    await expect(page.getByRole("heading", { name: "Box breathing" })).toBeVisible();
    await page.getByRole("button", { name: "Pause" }).click();
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
    await page.getByRole("button", { name: "Browse" }).click();
    await expect(page.getByPlaceholder("Search exercises")).toBeVisible();
  } finally {
    await context.close();
  }
});

test("journal keeps a selected photo after failed upload and offers retry", async ({ browser }, testInfo) => {
  test.skip(!["mobile-chrome", "mobile-safari"].includes(testInfo.project.name));
  const context = await browser.newContext({ storageState: memberState });
  try {
    const page = await context.newPage();
    await page.goto("/journal/new");
    await page.getByRole("textbox", { name: "Reflection title" }).fill("Disposable photo retry QA");
    await page.getByRole("textbox", { name: "Start writing" }).fill("A short synthetic note to test photo retry.");
    const upload = "**/api/v1/journals/draft/images/*";
    await page.route(upload, (route) => route.request().method() === "PUT" ? route.abort() : route.continue());
    await page.getByLabel("Upload journal photos")
      .setInputFiles(path.resolve(process.cwd(), "public/landing/growth/growth-reading-01.png"));
    await expect(page.getByRole("alert").filter({ hasText: "Retry the photo" })).toBeVisible();
    await expect(page.getByRole("img", { name: "growth-reading-01.png" })).toBeVisible();
    await page.unroute(upload);
    await page.getByRole("button", { name: "Retry growth-reading-01.png" }).click();
    await expect(page.getByText("Memory 1")).toBeVisible();
    await page.getByRole("button", { name: "Remove growth-reading-01.png" }).click();
    await expect(page.getByRole("img", { name: "growth-reading-01.png" })).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("journal detail shows owned data and hides it from another account", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome");
  if (!routeIds.journalId) throw new Error("A disposable journalId is required.");
  const unrelatedState = path.resolve(stateDirectory!, "unrelated.json");
  if (!existsSync(unrelatedState)) throw new Error("An unrelated-user browser state is required.");
  const owner = await browser.newContext({ storageState: memberState });
  const unrelated = await browser.newContext({ storageState: unrelatedState });
  try {
    const ownedPage = await owner.newPage();
    await ownedPage.goto(`/journal/${routeIds.journalId}`);
    await expect(ownedPage.getByRole("heading", { name: /Synthetic staging reflection/ })).toBeVisible();
    const otherPage = await unrelated.newPage();
    await otherPage.goto(`/journal/${routeIds.journalId}`);
    await expect(otherPage.getByText(/Entry not found|Could not load entry/)).toBeVisible();
    await expect(otherPage.getByText(/Synthetic staging reflection/)).toHaveCount(0);
    await otherPage.goto("/journal/44444444-4444-4444-8444-444444444444");
    await expect(otherPage.getByText(/Entry not found|Could not load entry/)).toBeVisible();
  } finally {
    await owner.close();
    await unrelated.close();
  }
});

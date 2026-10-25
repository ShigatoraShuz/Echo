import { expect, test, type Page } from "@playwright/test";
import { caseId, fixtures } from "./fixtures";
function pending() { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; }
for (const width of [1440, 390]) {
  test.describe(width + "px Professional performance regressions", () => {
    test.use({ viewport: { width, height: 1000 } });
    const navigate = async (page: Page, name: string) => {
      if (width < 1024 && name === "Resources") {
        await page.getByRole("button", { name: "Open workspace menu" }).click();
        await page.getByRole("dialog").getByRole("link", { name, exact: true }).click();
      } else await page.getByRole("navigation", { name: width < 1024 ? "Professional mobile navigation" : "Professional workspace", exact: true }).getByRole("link", { name, exact: true }).click();
    };
    test("one membership call per route, parallel Today reads, fresh organization scope", async ({ page }) => {
      const state = await fixtures(page); state.paginatedQueue = true;
      const hold = pending(); state.holds.queue = hold.promise;
      await page.goto("/professional?organization=org-one");
      await expect.poll(() => state.calls.filter(c => c.method === "dashboard").length).toBe(1);
      await expect(page.getByRole("status", { name: "Loading request queue" })).toBeVisible();
      expect(state.calls.filter(c => c.method === "memberships")).toHaveLength(1);
      hold.release(); delete state.holds.queue;
      await expect(page.getByRole("link", { name: "Open case", exact: true })).toBeVisible();
      let checks = 1;
      for (const name of ["Requests", "My cases", "Calendar", "Resources", "Today"]) {
        await navigate(page, name);
        if (name === "Calendar") await expect(page.getByText("No upcoming appointments", { exact: true })).toBeVisible();
        else if (name === "Resources") await expect(page.getByText(/No reviewed crisis resources are available in this response/)).toBeVisible();
        else await expect(page.getByRole("link", { name: "Open case", exact: true })).toBeVisible();
        checks++;
        expect(state.calls.filter(c => c.method === "memberships")).toHaveLength(checks);
      }
      const delayed = pending(); state.holds["queue:org-two"] = delayed.promise;
      await page.getByLabel("Active organization").selectOption("org-two");
      await expect.poll(() => state.calls.filter(c => c.method === "queue" && c.args[0] === "org-two").length).toBe(1);
      await expect(page.getByRole("link", { name: "Open case", exact: true })).toHaveCount(0);
      await expect(page.locator('a[href*="/professional/cases/"][href*="organization=org-one"]')).toHaveCount(0);
      delayed.release();
      await expect(page.getByRole("link", { name: "Open case", exact: true })).toHaveAttribute("href", "/professional/cases/" + caseId + "?organization=org-two");
      expect(state.calls.filter(c => c.method === "memberships")).toHaveLength(checks + 1);
      expect(state.calls.filter(c => c.method === "caseDetail")).toHaveLength(0);
    });
    test("navigation checks revoked access instead of reusing prior approval", async ({ page }) => {
      const state = await fixtures(page);
      await page.goto("/professional/requests?organization=org-one");
      await expect(page.getByRole("link", { name: "Open case", exact: true })).toBeVisible();
      state.memberships = state.memberships.map(m => ({ ...m, status: "suspended", accessState: "suspended_membership" }));
      const queues = state.calls.filter(c => c.method === "queue").length;
      await navigate(page, "My cases");
      await expect(page).toHaveURL(/professional.access/);
      await expect(page.getByText("Professional access suspended", { exact: true })).toHaveCount(state.memberships.length);
      await expect(page.getByRole("heading", { name: "Access is not active yet", exact: true })).toBeVisible();
      expect(state.calls.filter(c => c.method === "queue")).toHaveLength(queues);
      await expect(page.getByRole("link", { name: "Open case", exact: true })).toHaveCount(0);
    });
    test("logout clears clinical UI; synthetic password login checks access again", async ({ page }) => {
      const state = await fixtures(page); state.loginSuccess = true;
      await page.goto("/professional/cases/" + caseId + "?organization=org-one");
      await expect(page.getByText("Fictional shared message for browser tests", { exact: true })).toBeVisible();
      if (width < 1024) await page.getByRole("button", { name: "Open workspace menu" }).click();
      else await page.getByRole("button", { name: "Open account menu" }).click();
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Professional sign in", exact: true })).toBeVisible();
      await expect(page.getByText("Fictional shared message for browser tests", { exact: true })).toHaveCount(0);
      const checks = state.calls.filter(c => c.method === "memberships").length;
      await page.getByRole("button", { name: "Password", exact: true }).click();
      await page.getByRole("textbox", { name: /Email address/ }).fill("fictional@example.invalid");
      await page.locator('input[type="password"]').fill("Synthetic-local-password1!");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Choose an organization" })).toBeVisible();
      expect(state.calls.filter(c => c.method === "memberships")).toHaveLength(checks + 1);
      await page.getByRole("button", { name: /Fictional org-two.*Enter workspace/ }).click();
      await expect(page.getByLabel("Active organization")).toHaveValue("org-two");
      await expect(page.getByRole("link", { name: "Open case", exact: true })).toHaveAttribute("href", "/professional/cases/" + caseId + "?organization=org-two");
      expect(state.calls.filter(c => c.method === "memberships")).toHaveLength(checks + 2);
    });
    test("account invalidation unmounts sensitive information", async ({ page }) => {
      await fixtures(page);
      await page.goto("/professional/cases/" + caseId);
      await expect(page.getByText("Fictional shared message for browser tests", { exact: true })).toBeVisible();
      await page.evaluate(() => window.dispatchEvent(new Event("echo:sensitive-state-cleared")));
      await expect(page.getByText("Fictional shared message for browser tests", { exact: true })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Sign in again", exact: true })).toBeVisible();
    });
  });
}

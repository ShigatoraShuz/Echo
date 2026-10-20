import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Request } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import manifest from "./route-manifest.json";

const stateDirectory = process.env.ECHO_STAGING_AUTH_STATE_DIR;
const routeIdsFile = process.env.ECHO_STAGING_ROUTE_IDS_FILE;
if (!stateDirectory || !routeIdsFile) {
  throw new Error("Set ECHO_STAGING_AUTH_STATE_DIR and ECHO_STAGING_ROUTE_IDS_FILE for staging route QA.");
}
const routeIds = JSON.parse(readFileSync(routeIdsFile, "utf8")) as Record<string, string>;
const idForPath: Record<string, string> = {
  "/journal/[id]": "journalId",
  "/professional-support/requests/[id]": "userSupportRequestId",
  "/professional/my-requests/[id]": "userSupportRequestId",
  "/professional/cases/[id]": "practitionerCaseId",
};

function resolvedPath(route: string): string {
  const key = idForPath[route];
  if (!key) return route;
  const id = routeIds[key];
  if (!id || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)) {
    throw new Error(`Staging route ${route} requires a valid ${key} fixture ID.`);
  }
  return route.replace("[id]", encodeURIComponent(id));
}

function expectedDestination(route: string): string {
  const aliases: Record<string, string> = {
    "/onboarding": "/onboarding/age",
    "/admin": "/admin/verifications",
    "/professional/request": "/professional-support/requests/new",
    "/professional/my-requests": "/professional-support/requests",
    "/insights/emotion": "/insights",
    "/insights/risk": "/insights",
    "/insights/facial": "/insights",
  };
  if (route === "/professional/my-requests/[id]") {
    return `/professional-support/requests/${routeIds.userSupportRequestId}`;
  }
  return aliases[route] ?? resolvedPath(route);
}

function storageState(fixture: string): string | undefined {
  if (fixture === "none" || fixture === "auth" || fixture === "privileged-auth" || fixture === "preview") return undefined;
  const file = path.resolve(stateDirectory!, `${fixture}.json`);
  if (!existsSync(file)) throw new Error(`Missing staging browser state for ${fixture}: ${file}`);
  return file;
}

const pages = manifest.filter((entry) => entry.kind !== "callback");
const coreFixtures = new Set([
  "none", "auth", "privileged-auth", "preview", "new-user", "consent-user", "profile-user",
  "setup-user", "policies-user", "member", "journal", "calendar", "insights",
]);
for (const entry of pages) {
  test(`${entry.role} ${entry.path} loads and exposes its controls`, async ({ browser }, testInfo) => {
    test.skip(process.env.ECHO_STAGING_TIER === "core" && !coreFixtures.has(entry.fixture), "Requires gated or privileged staging fixture.");
    test.skip(
      !["desktop-chrome", "mobile-chrome", "mobile-safari"].includes(testInfo.project.name),
      "The complete route matrix runs on desktop and both phone engines.",
    );
    const context = await browser.newContext({ storageState: storageState(entry.fixture) });
    try {
      const page = await context.newPage();
      const pageErrors: string[] = [];
      const apiResponses: Array<{ path: string; status: number; durationMs: number; requestId: string | null }> = [];
      const startedRequests = new Map<Request, number>();
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("request", (request) => {
        if (new URL(request.url()).pathname.includes("/api/v1/")) startedRequests.set(request, Date.now());
      });
      page.on("response", (received) => {
        const url = new URL(received.url());
        if (!url.pathname.includes("/api/v1/")) return;
        apiResponses.push({
          path: url.pathname, status: received.status(),
          durationMs: Date.now() - (startedRequests.get(received.request()) ?? Date.now()),
          requestId: received.headers()["x-request-id"] ?? null,
        });
      });
      const navigationStarted = Date.now();
      const response = await page.goto(resolvedPath(entry.path), { waitUntil: "domcontentloaded" });
      expect(response?.status(), `Document response for ${entry.path}`).toBeLessThan(500);
      await expect(page, `${entry.path} destination`).toHaveURL((url) => url.pathname === expectedDestination(entry.path));
      await expect(page.locator("h1:visible").first()).toBeVisible();
      if (entry.role !== "public") {
        expect(new URL(page.url()).pathname, `${entry.path} redirected out of its allowed role`).not.toBe("/login");
      }
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      expect(pageErrors, `Uncaught errors on ${entry.path}`).toEqual([]);
      await testInfo.attach("route-timing-and-api", {
        body: JSON.stringify({ navigationMs: Date.now() - navigationStarted, apiResponses }, null, 2),
        contentType: "application/json",
      });
      const controls = await page.locator("a:visible, button:visible, input:visible, textarea:visible, select:visible")
        .evaluateAll((nodes) => nodes.map((node) => ({
          tag: node.tagName.toLowerCase(),
          label: node.getAttribute("aria-label") || (node as HTMLInputElement).labels?.[0]?.textContent?.trim().slice(0, 100) ||
            node.getAttribute("placeholder") || node.textContent?.trim().slice(0, 100) || "",
          target: node.getAttribute("href") || "",
        })));
      await testInfo.attach("visible-controls", { body: JSON.stringify(controls, null, 2), contentType: "application/json" });
      expect(controls.filter((control) => !control.label && !control.target), `Unnamed controls on ${entry.path}`).toEqual([]);
      const accessibility = await new AxeBuilder({ page }).analyze();
      expect(
        accessibility.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? "")),
        `Serious accessibility violations on ${entry.path}`,
      ).toEqual([]);
      if (testInfo.project.name === "mobile-chrome") {
        await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
          `${entry.path} overflows at 200% text size`).toBeLessThanOrEqual(1);
      }
    } finally {
      await context.close();
    }
  });
  if (entry.role !== "public") {
    test(`anonymous visitor cannot open ${entry.path}`, async ({ browser }, testInfo) => {
      test.skip(process.env.ECHO_STAGING_TIER === "core" && !coreFixtures.has(entry.fixture), "Requires a dynamic gated or privileged fixture ID.");
      test.skip(testInfo.project.name !== "desktop-chrome", "One desktop guard check per protected route is sufficient.");
      const context = await browser.newContext();
      try {
        const page = await context.newPage();
        await page.goto(resolvedPath(entry.path), { waitUntil: "domcontentloaded" });
        expect(["/login", "/professional/login"]).toContain(new URL(page.url()).pathname);
      } finally {
        await context.close();
      }
    });
  }
}

test("invalid authentication callback does not open a protected page", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "Callback behavior is browser independent.");
  await page.goto("/callback?code=invalid-staging-qa-code", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL((url) => url.pathname === "/login" && url.searchParams.get("error") === "sign_in_session_expired");
});

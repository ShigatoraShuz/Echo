import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const publicRoutes = [
  "/",
  "/about",
  "/privacy-policy",
  "/terms",
  "/crisis",
  "/crisis-help",
  "/support/find-help",
  "/login",
  "/signup",
];

for (const route of publicRoutes) {
  test(`${route} fits the viewport and has a visible heading`, async ({ page }) => {
    await page.goto(route);
    await expect(page.getByRole("button", { name: /begin your quiet journey/i })).toHaveCount(0);
    await expect(page.locator("h1").first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
      .toBeLessThanOrEqual(1);
  });
}

for (const route of ["/login", "/signup", "/forgot-password", "/reset-password"]) {
  test(`${route} remains readable at 200% text size`, async ({ page }) => {
    await page.goto(route);
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    await expect(page.locator("h1").first()).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
      .toBeLessThanOrEqual(1);
  });
}

for (const route of ["/login", "/signup"]) {
  test(`${route} has no serious or critical automated accessibility violations`, async ({ page }) => {
    await page.goto(route);
    const result = await new AxeBuilder({ page }).analyze();
    expect(result.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  });
}

test("landing mobile menu reaches public information and can close", async ({ page }) => {
  await page.goto("/");
  const menu = page.getByRole("button", { name: /toggle navigation/i });
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeFocused();
  await menu.click();
  const about = page.getByRole("banner", { name: "Main navigation" }).getByRole("link", { name: "About", exact: true });
  await expect(about).toBeVisible();
  await about.click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.locator("h1").first()).toBeVisible();
});

test("landing has no automatically detectable critical accessibility errors", async ({ page }) => {
  await page.goto("/");
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter((violation) => violation.impact === "critical")).toEqual([]);
});

test("landing primary actions fit the first phone viewport", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablet", "Phone-specific first viewport check");
  await page.goto("/");
  for (const label of ["Start privately", "See how it works"]) {
    const action = page.getByRole("main").getByRole("link", { name: label }).first();
    await expect
      .poll(async () => {
        const bounds = await action.boundingBox();
        return bounds ? bounds.y + bounds.height : Number.POSITIVE_INFINITY;
      })
      .toBeLessThanOrEqual(page.viewportSize()!.height);
  }
});

test("landing motion runs normally and stops for reduced motion", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator(".landing-page-canvas");
  await expect(canvas).toBeVisible();
  await expect.poll(() => canvas.evaluate((node) => getComputedStyle(node).animationName)).toBe("echo-landing-canvas-flow");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => canvas.evaluate((node) => getComputedStyle(node).animationName)).toBe("none");
  await page.evaluate(() => { document.documentElement.dataset.echoMotion = "full"; });
  await expect.poll(() => canvas.evaluate((node) => getComputedStyle(node).animationName)).toBe("echo-landing-canvas-flow");
  await expect(page.getByRole("link", { name: "Start privately" }).first()).toBeVisible();
});

test("phone hero actions align and How it works opens at the right section", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablet", "Phone-specific landing layout");
  await page.goto("/");
  const primary = await page.getByRole("link", { name: "Start privately" }).first().boundingBox();
  const secondary = await page.getByRole("link", { name: "See how it works" }).boundingBox();
  expect(primary).not.toBeNull();
  expect(secondary).not.toBeNull();
  expect(Math.abs(primary!.x - secondary!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(primary!.width - secondary!.width)).toBeLessThanOrEqual(1);

  await page.getByRole("link", { name: "See how it works" }).click();
  await expect(page).toHaveURL(/\/#how-it-works$/);
  const heading = page.getByRole("heading", { name: /from a quick check-in to a clearer next step/i });
  await expect.poll(async () => (await heading.boundingBox())?.y ?? Infinity).toBeLessThan(page.viewportSize()!.height / 2);
  const header = page.locator('header[aria-label="Main navigation"]:visible');
  await expect.poll(async () => (await header.boundingBox())?.y ?? Infinity).toBeLessThan(20);
  await expect(page.getByRole("tab", { name: /05 choose a next step/i })).toBeVisible();
  const tablist = page.getByRole("tablist", { name: "How ECHO works steps" });
  expect(await tablist.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);

  await page.getByRole("tab", { name: /02 write privately/i }).click();
  await expect(page.getByRole("heading", { name: /write what.s on your mind/i })).toBeVisible();
  await page.getByRole("button", { name: /next: reflect with buddy/i }).click();
  await expect(page.getByRole("heading", { name: /add another perspective/i })).toBeVisible();
});

test("mobile navigation reaches How it works from About", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablet", "Phone-specific navigation");
  await page.goto("/about");
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "How it works" }).click();
  await expect(page).toHaveURL(/\/#how-it-works$/);
  const heading = page.getByRole("heading", { name: /from a quick check-in to a clearer next step/i });
  await expect.poll(async () => (await heading.boundingBox())?.y ?? Infinity).toBeLessThan(page.viewportSize()!.height / 2);
});

test("public dashboard preview has a usable phone menu without private destinations", async ({ page }) => {
  await page.goto("/dashboard-preview");
  const trigger = page.getByRole("button", { name: "Open navigation" });
  await trigger.click();
  const menu = page.getByRole("dialog", { name: "App navigation" });
  await expect(menu.getByRole("link", { name: "Find help" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Log in" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Settings" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("phone login keeps password controls readable and rejects invalid email before submission", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablet", "Phone-specific login layout");
  await page.goto("/login");
  await page.getByRole("button", { name: "Show password" }).click();
  await page.getByRole("button", { name: "Hide password" }).click();
  const remember = page.locator("label").filter({ hasText: "Remember me on this device" });
  const forgot = page.getByRole("link", { name: "Forgot password?" });
  const rememberBox = await remember.boundingBox();
  const forgotBox = await forgot.boundingBox();
  expect(rememberBox).not.toBeNull();
  expect(forgotBox).not.toBeNull();
  expect(rememberBox!.y + rememberBox!.height).toBeLessThanOrEqual(forgotBox!.y);
  expect(rememberBox!.height).toBeGreaterThanOrEqual(44);
  expect(forgotBox!.height).toBeGreaterThanOrEqual(44);

  await page.getByPlaceholder("Enter your password").fill("example-password");
  const email = page.getByRole("textbox", { name: "Email address" });
  await email.fill("invalid' OR '1'='1");
  await expect(email).toHaveValue("invalid' OR '1'='1");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByText("Please enter a valid email address")).toBeVisible();
  await expect(page.getByPlaceholder("Enter your password")).toHaveValue("example-password");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test("crisis call actions remain reachable when the resource directory fails", async ({ page }) => {
  await page.route("**/api/v1/support-resources**", (route) => route.abort());
  await page.goto("/crisis");
  const emergency = page.getByRole("link", { name: "Call emergency services 911" });
  const hotline = page.getByRole("link", { name: "Call NCMH Crisis Hotline 1553" });
  await expect(emergency).toHaveAttribute("href", "tel:911");
  await expect(hotline).toHaveAttribute("href", "tel:1553");
  await expect(emergency).toBeVisible();
  await expect(hotline).toBeVisible();
  await expect.poll(async () => (await emergency.boundingBox())?.y ?? Infinity).toBeLessThan(page.viewportSize()!.height);
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();

  await page.goto("/support/find-help");
  await expect(page.getByRole("link", { name: /open crisis support/i }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

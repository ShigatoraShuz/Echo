const path = require("node:path");
const root = path.resolve(__dirname, "../..");
if (!process.env.ECHO_TEST_EMAIL || !process.env.ECHO_TEST_PASSWORD)
  throw Error(
    "Set ECHO_TEST_EMAIL and ECHO_TEST_PASSWORD for the intended development account.",
  );
const { createRequire } = require("node:module");
const fs = require("node:fs");
const requireEcho = createRequire(path.join(root, "package.json"));
const { chromium, expect } = requireEcho("@playwright/test");
const out = path.join(root, "artifacts/model-integration/dashboard-premium");
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1728, height: 1117 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    sessionStorage.setItem("echo.dashboard.welcome-shown", "true");
    localStorage.setItem("echo.dashboard.ai-intro-seen", "true");
  });
  try {
    await page.goto("http://127.0.0.1:3000/login?next=/dashboard");
    await page.getByLabel(/^Email address/).fill(process.env.ECHO_TEST_EMAIL);
    await page
      .locator("input[type=password]")
      .fill(process.env.ECHO_TEST_PASSWORD);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.waitForURL("**/dashboard", { timeout: 90000 });
    await page.locator(".dashboard-premium").waitFor();
    const animationNames = await page.evaluate(() =>
      document
        .getAnimations()
        .map((a) => a.animationName)
        .filter(Boolean),
    );
    await page.screenshot({ path: out + "/entrance.png" });
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter((a) => a.effect?.getTiming().iterations !== Infinity)
          .map((a) => a.finished.catch(() => {})),
      ),
    );
    await page.screenshot({ path: out + "/desktop.png", fullPage: true });
    const geometry = await page
      .locator(".dashboard-premium")
      .evaluate((el) => ({
        width: innerWidth,
        overflow: document.documentElement.scrollWidth > innerWidth,
        cards: [
          ...el.querySelectorAll(
            ".dashboard-top-grid>* ,.dashboard-main-grid>section",
          ),
        ].map((x) => {
          const r = x.getBoundingClientRect();
          return {
            label: x.innerText.slice(0, 45),
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
          };
        }),
      }));
    const analysis = page.getByRole("region", {
      name: "Saved AI result summary",
    });
    const details = analysis.getByRole("button", {
      name: "Details",
      exact: true,
    });
    await details.click();
    await expect(details).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.getByRole("dialog", { name: "Journal analysis details" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Your reflection patterns",
        exact: true,
      }),
    ).toBeVisible();
    await page.waitForTimeout(700);
    await page.screenshot({
      path: out + "/analysis-details.png",
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Journal analysis details" }),
    ).toHaveCount(0);
    await expect(details).toHaveAttribute("aria-expanded", "false");
    await expect(details).toBeFocused();
    const overall = page.locator(".dashboard-overall-summary");
    const overallDetails = overall.getByRole("button", {
      name: "Details",
      exact: true,
    });
    await overallDetails.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("dialog", { name: "Your past 30 days" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Journal estimate direction" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close dialog" }).click();
    await expect(overallDetails).toHaveAttribute("aria-expanded", "false");
    await page.getByRole("radio", { name: "Today", exact: true }).click();
    await expect(
      page.getByRole("radio", { name: "Today", exact: true }),
    ).toHaveAttribute("aria-checked", "true");
    await page
      .getByRole("radio", { name: "the last month", exact: true })
      .click();
    for (const [name, param] of [
      ["the last 6 months", "range=custom"],
      ["the last 3 months", "range=90d"],
    ]) {
      const request = page.waitForResponse(
        (r) =>
          r.url().includes("/dashboard/insights?") && r.url().includes(param),
      );
      await page.getByRole("radio", { name, exact: true }).click();
      const response = await request;
      if (!response.ok())
        throw Error("History " + param + " returned " + response.status());
      await expect(page.getByText("Loading your saved analyses…")).toHaveCount(
        0,
      );
    }
    await page
      .getByRole("combobox", { name: "Choose wellbeing activity range" })
      .selectOption("52");
    await expect(page.getByRole("gridcell")).toHaveCount(364);
    await page.getByRole("gridcell").last().focus();
    await expect(page.getByRole("tooltip")).toBeVisible();
    await page.keyboard.press("Escape");
    await page
      .getByRole("combobox", { name: "Choose wellbeing activity range" })
      .selectOption("26");
    const card = page.locator(".dashboard-reflection-card");
    await card.hover({ position: { x: 40, y: 45 } });
    const hover = await card.getAttribute("style");
    await page.screenshot({ path: out + "/hover.png", fullPage: true });
    for (const width of [1280, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        throw Error("Horizontal overflow at " + width);
      if (width === 390)
        await page.screenshot({ path: out + "/mobile.png", fullPage: true });
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1536, height: 960 });
    await page.reload();
    await page.locator(".dashboard-premium").waitFor();
    const reduced = await page
      .locator(".echo-dashboard-hero")
      .evaluate((el) => getComputedStyle(el).animationName);
    if (reduced !== "none") throw Error("Reduced motion not respected");
    await page.getByRole("link", { name: "New entry", exact: true }).click();
    await page.waitForURL("**/journal/new");
    await expect(page.getByLabel("Reflection title")).toBeVisible();
    fs.writeFileSync(
      out + "/verification.json",
      JSON.stringify(
        {
          animationNames,
          geometry,
          hover,
          reduced,
          errors,
          detailsMouseAndKeyboard: true,
          mobileWidths: [1280, 1024, 768, 390],
          reflectionCta: true,
        },
        null,
        2,
      ),
    );
    if (errors.length) throw Error(errors.join("; "));
    console.log(
      "PASS dashboard: actual data, Details mouse/keyboard, chart filters, activity detail, hover, responsive widths, reduced motion, journal CTA",
    );
  } catch (e) {
    console.error(e);
    console.log((await page.locator("body").innerText()).slice(-2000));
    await page.screenshot({ path: out + "/failure.png", fullPage: true });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();

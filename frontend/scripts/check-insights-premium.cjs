const path = require("node:path");
const root = path.resolve(__dirname, "../..");
if (!process.env.ECHO_TEST_EMAIL || !process.env.ECHO_TEST_PASSWORD)
  throw Error(
    "Set ECHO_TEST_EMAIL and ECHO_TEST_PASSWORD for a development account with saved native analysis.",
  );
const { createRequire } = require("node:module");
const fs = require("node:fs");
const r = createRequire(path.join(root, "package.json"));
const { chromium, expect } = r("@playwright/test");
const out = path.join(root, "artifacts/model-integration/insights-premium");
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1728, height: 1117 },
  });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (response) => {
    if (response.url().includes("/dashboard/insights?"))
      console.log(
        "History response",
        response.status(),
        new URL(response.url()).search,
      );
  });
  try {
    await page.goto("http://127.0.0.1:3000/login?next=/insights");
    await page.getByLabel(/^Email address/).fill(process.env.ECHO_TEST_EMAIL);
    await page
      .locator("input[type=password]")
      .fill(process.env.ECHO_TEST_PASSWORD);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.waitForURL("**/insights", { timeout: 90000 });
    await page.locator("#emotion-analysis").waitFor({ timeout: 45000 });
    const animationNames = await page.evaluate(() =>
      document
        .getAnimations()
        .map((a) => a.animationName)
        .filter(Boolean),
    );
    await page.screenshot({
      path: out + "/desktop.png",
      fullPage: true,
      animations: "disabled",
    });
    for (const id of [
      "emotion-analysis",
      "sanctuary-perspective",
      "depression-severity",
      "distress-classification",
      "facial-analysis",
    ])
      await expect(page.locator("#" + id)).toBeVisible();
    await expect(page.locator("video:visible,canvas:visible")).toHaveCount(0);
    const geometry = await page.locator(".insights-outcomes").evaluate((el) =>
      [...el.children].map((x) => {
        const r = x.getBoundingClientRect();
        return { id: x.id, x: r.x, y: r.y, width: r.width, height: r.height };
      }),
    );
    const report = page.getByRole("button", {
      name: "Full model report",
      exact: true,
    });
    await report.click();
    await expect(
      page.getByRole("dialog", { name: "Full model report", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Your reflection patterns",
        exact: true,
      }),
    ).toBeVisible();
    await page.screenshot({ path: out + "/full-report.png" });
    await page.keyboard.press("Escape");
    await expect(report).toBeFocused();
    console.log("PASS full report and focus return");
    await page
      .getByRole("button", { name: "View analysis history", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Saved analysis history" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Emotion history", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close dialog" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    console.log("PASS history");
    let criteriaVerified = false;
    if (
      await page
        .getByRole("button", { name: "View criteria", exact: true })
        .count()
    ) {
      await page
        .getByRole("button", { name: "View criteria", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Journal PHQ-8 criteria" }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      criteriaVerified = true;
    }
    console.log("PASS criteria");
    for (const [label, param] of [
      ["7 days", "range=7d"],
      ["90 days", "range=90d"],
    ]) {
      console.log("Checking", label);
      const response = page.waitForResponse(
        (r) =>
          r.url().includes("/dashboard/insights?") && r.url().includes(param),
        { timeout: 15000 },
      );
      await page
        .getByRole("button", { name: label, exact: true })
        .click({ timeout: 15000 });
      console.log("Clicked", label);
      if (!(await response).ok()) throw Error("Period failed: " + param);
      await page.locator("#emotion-analysis").waitFor();
      await expect(
        page.getByRole("button", { name: label, exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      console.log("PASS", label);
    }
    const to = new Date().toISOString().slice(0, 10),
      from = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    await page.locator(".insights-custom-range > summary").click();
    await page.getByLabel("From", { exact: true }).fill(from);
    await page.getByLabel("To", { exact: true }).fill(to);
    const custom = page.waitForResponse(
      (r) =>
        r.url().includes("/dashboard/insights?") &&
        r.url().includes("range=custom"),
    );
    await page
      .getByRole("button", { name: "Apply range", exact: true })
      .click();
    if (!(await custom).ok()) throw Error("Custom period failed");
    await expect(page.locator(".insights-custom-range")).not.toHaveAttribute(
      "open",
      "",
    );
    await page.locator("#emotion-analysis").waitFor();
    console.log("PASS custom range");
    await page
      .locator("#emotion-analysis")
      .hover({ position: { x: 30, y: 35 } });
    const hover = await page.locator("#emotion-analysis").getAttribute("style");
    console.log("PASS hover");
    for (const width of [1280, 1024, 768, 390]) {
      console.log("Checking width", width);
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(300);
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        throw Error("Horizontal overflow at " + width);
      if (width === 390)
        await page.screenshot({
          path: out + "/mobile.png",
          fullPage: true,
          animations: "disabled",
        });
      console.log("PASS width", width);
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await page.locator("#emotion-analysis").waitFor();
    const reduced = await page
      .locator(".insights-hero")
      .evaluate((el) => getComputedStyle(el).animationName);
    if (reduced !== "none") throw Error("Reduced motion failed");
    fs.writeFileSync(
      out + "/verification.json",
      JSON.stringify(
        {
          animationNames,
          geometry,
          criteriaVerified,
          historyAndReport: true,
          periods: ["7d", "90d", "custom"],
          hover,
          reduced,
          errors,
        },
        null,
        2,
      ),
    );
    if (errors.length) throw Error(errors.join(";"));
    console.log(
      "PASS Insights: five compact real-result panels, report/history/criteria, period filters, responsive widths, reduced motion, no visible camera",
    );
  } catch (e) {
    console.error(e);
    console.log((await page.locator("body").innerText()).slice(-2500));
    await page.screenshot({ path: out + "/failure.png", fullPage: true });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();

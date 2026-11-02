const fs = require("node:fs"),
  { createRequire } = require("node:module");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
if (
  !process.env.ECHO_TEST_EMAIL ||
  !process.env.ECHO_TEST_PASSWORD ||
  !process.env.ECHO_TEST_JOURNAL_ID
)
  throw Error(
    "Set ECHO_TEST_EMAIL, ECHO_TEST_PASSWORD and ECHO_TEST_JOURNAL_ID for an existing analyzed test journal.",
  );
if (!/^[a-f0-9-]{36}$/i.test(process.env.ECHO_TEST_JOURNAL_ID))
  throw Error("Invalid test journal ID");
if (process.env.PERF_PHASE && !/^[a-z0-9-]+$/.test(process.env.PERF_PHASE))
  throw Error("Invalid benchmark label");
const { chromium, expect } = createRequire(root + "/package.json")(
  "@playwright/test",
);
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1536, height: 960 },
  });
  const results = [];
  try {
    await page.goto("http://127.0.0.1:3000/login?next=/dashboard");
    await page.getByLabel(/^Email address/).fill(process.env.ECHO_TEST_EMAIL);
    await page
      .locator("input[type=password]")
      .fill(process.env.ECHO_TEST_PASSWORD);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.waitForURL("**/dashboard", { timeout: 90000 });
    await page.locator(".dashboard-premium").waitFor({ timeout: 60000 });
    for (let run = 0; run < 3; run++)
      for (const [route, selector] of [
        ["/dashboard", ".dashboard-premium"],
        ["/insights", ".insights-metrics"],
        ["/journal/new", "textarea"],
        ["/journal/" + process.env.ECHO_TEST_JOURNAL_ID, "[role=tablist]"],
      ]) {
        const requests = [];
        const started = new Map();
        const onrequest = (r) => {
          if (r.url().startsWith("http://127.0.0.1:4200/"))
            started.set(r, performance.now());
        };
        const onresponse = (r) => {
          const t = started.get(r.request());
          if (t)
            requests.push({
              path: new URL(r.url()).pathname,
              ms: Math.round(performance.now() - t),
              status: r.status(),
            });
        };
        page.on("request", onrequest);
        page.on("response", onresponse);
        const start = performance.now();
        await page.goto("http://127.0.0.1:3000" + route);
        await page.locator(selector).first().waitFor({ timeout: 60000 });
        if (route === "/journal/new")
          await expect(
            page.getByRole("button", { name: "Save reflection", exact: true }),
          ).toBeEnabled({ timeout: 60000 });
        const readyMs = Math.round(performance.now() - start);
        await page.waitForTimeout(500);
        const resources = await page.evaluate(() =>
          performance
            .getEntriesByType("resource")
            .filter((r) => r.name.includes("/_next/") && r.name.includes(".js"))
            .reduce(
              (a, r) => ({
                bytes: a.bytes + r.transferSize,
                count: a.count + 1,
              }),
              { bytes: 0, count: 0 },
            ),
        );
        page.off("request", onrequest);
        page.off("response", onresponse);
        const row = { run, route, readyMs, resources, requests };
        results.push(row);
        console.log(JSON.stringify(row));
      }
    fs.writeFileSync(
      root +
        "/artifacts/model-integration/" +
        (process.env.PERF_PHASE || "before") +
        "-ui-performance.json",
      JSON.stringify(results, null, 2),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

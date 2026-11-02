const path = require("node:path");
const root = path.resolve(__dirname, "../..");
if (!process.env.ECHO_TEST_EMAIL || !process.env.ECHO_TEST_PASSWORD)
  throw Error(
    "Set ECHO_TEST_EMAIL and ECHO_TEST_PASSWORD for the intended development account. This check uses a real webcam.",
  );
const { createRequire } = require("node:module"),
  fs = require("node:fs");
const r = createRequire(path.join(root, "package.json"));
const { chromium, expect } = r("@playwright/test");
const out = path.join(root, "artifacts/model-integration/face-studio");
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({
    permissions: ["camera"],
    viewport: { width: 1536, height: 960 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  let auth = "",
    original = null,
    ownDraft = false;
  const title = "Fictional camera lifecycle verification",
    body =
      "Temporary software lifecycle test. This draft is removed after verification.";
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (
      r.url().startsWith("http://127.0.0.1:4200/") &&
      r.headers().authorization
    )
      auth = r.headers().authorization;
  });
  await page.addInitScript(() => {
    window.__faceTestTracks = [];
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (...args) => {
      const stream = await original(...args);
      window.__faceTestTracks.push(...stream.getVideoTracks());
      return stream;
    };
  });
  const api = async (path, options = {}) => {
    const response = await page.request.fetch(
      "http://127.0.0.1:4200/api/v1" + path,
      { ...options, headers: { authorization: auth, ...options.headers } },
    );
    if (!response.ok()) throw Error(path + " " + response.status());
    return response.status() === 204 ? null : response.json();
  };
  try {
    await page.goto("http://127.0.0.1:3000/login?next=/settings/privacy");
    await page.getByLabel(/^Email address/).fill(process.env.ECHO_TEST_EMAIL);
    await page
      .locator("input[type=password]")
      .fill(process.env.ECHO_TEST_PASSWORD);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.waitForURL("**/settings/privacy", { timeout: 90000 });
    await page
      .getByRole("switch", { name: "Automatic facial analysis", exact: true })
      .waitFor();
    original = (await api("/settings")).data.privacy;
    const toggle = page.getByRole("switch", {
      name: "Automatic facial analysis",
      exact: true,
    });
    if ((await toggle.getAttribute("aria-checked")) === "false") {
      await toggle.click();
      await page
        .getByRole("button", { name: "Save Privacy", exact: true })
        .click();
      await expect(
        page.getByText("Privacy choices saved.", { exact: true }),
      ).toBeVisible();
    }
    const draft = (await api("/journals/draft")).data;
    ownDraft = !draft?.title?.trim() && !draft?.body?.trim();
    await page.goto("http://127.0.0.1:3000/journal/new");
    await expect(
      page.getByRole("button", { name: "Save reflection", exact: true }),
    ).toBeEnabled();
    if (ownDraft) {
      await page.getByLabel("Reflection title").fill(title);
      await page.getByLabel("Start writing", { exact: true }).fill(body);
    }
    await expect(page.locator(".face-studio-viewport")).toHaveAttribute(
      "data-tracking",
      "true",
      { timeout: 45000 },
    );
    await page.screenshot({
      path: out + "/live-mesh-desktop.png",
      animations: "disabled",
    });
    await page.locator(".face-studio-settings a").click();
    await page.waitForURL("**/settings/privacy");
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.__faceTestTracks.every((t) => t.readyState === "ended"),
        ),
      )
      .toBe(true);
    console.log("PASS physical camera ended on route exit");
    await toggle.waitFor();
    await toggle.click();
    await page
      .getByRole("button", { name: "Save Privacy", exact: true })
      .click();
    await expect(
      page.getByText("Privacy choices saved.", { exact: true }),
    ).toBeVisible();
    await page.goto("http://127.0.0.1:3000/journal/new");
    await expect(
      page.getByRole("button", { name: "Save reflection", exact: true }),
    ).toBeEnabled();
    await expect(page.locator(".journal-face-studio")).toHaveCount(0);
    if (await page.evaluate(() => window.__faceTestTracks.length))
      throw Error("Camera requested while settings off");
    console.log("PASS settings off prevents camera requests");
    await page.goto("http://127.0.0.1:3000/settings/privacy");
    await toggle.waitFor();
    await toggle.click();
    await page
      .getByRole("button", { name: "Save Privacy", exact: true })
      .click();
    await expect(
      page.getByText("Privacy choices saved.", { exact: true }),
    ).toBeVisible();
    await page.goto("http://127.0.0.1:3000/journal/new");
    await expect(page.locator(".face-studio-viewport")).toHaveAttribute(
      "data-tracking",
      "true",
      { timeout: 45000 },
    );
    await page.setViewportSize({ width: 390, height: 844 });
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    )
      throw Error("Mobile overflow");
    await page.screenshot({
      path: out + "/live-mesh-mobile.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    if (
      (await page
        .locator(".face-studio-scan")
        .evaluate((el) => getComputedStyle(el).animationName)) !== "none"
    )
      throw Error("Reduced motion failed");
    await expect(page.locator(".face-studio-viewport")).toHaveAttribute(
      "data-tracking",
      "true",
    );
    await page.locator(".face-studio-settings a").click();
    await page.waitForURL("**/settings/privacy");
    const prior = JSON.parse(
      fs.readFileSync(out + "/physical-verification.json", "utf8"),
    );
    let propagated = false;
    const id = prior.savedJournalId;
    if (id) {
      const face = (await api("/journals/" + id + "/face")).data;
      if (face.result?.status !== "available")
        throw Error("Persisted face result missing");
      const dashboard = (await api("/dashboard")).data,
        insights = (await api("/dashboard/insights")).data;
      if (
        !dashboard.analysisInsights.facialResults?.some(
          (r) => r.journalId === id,
        ) ||
        !insights.facialResults?.some((r) => r.journalId === id)
      )
        throw Error("Saved face result not propagated");
      propagated = true;
      console.log("PASS saved face result in dashboard and insights");
    }
    fs.writeFileSync(
      out + "/lifecycle-verification.json",
      JSON.stringify(
        {
          physicalCamera: true,
          routeExitStopsTracks: true,
          settingsOffMakesNoCameraRequest: true,
          reducedMotionRetainsTracking: true,
          mobileOverflow: false,
          savedResultsPropagated: propagated,
          errors,
        },
        null,
        2,
      ),
    );
    if (errors.length) throw Error(errors.join(";"));
    console.log("PASS physical camera lifecycle");
  } catch (e) {
    console.error(e);
    console.log((await page.locator("body").innerText()).slice(-1500));
    await page
      .screenshot({
        path: out + "/lifecycle-failure.png",
        animations: "disabled",
      })
      .catch(() => {});
    process.exitCode = 1;
  } finally {
    if (auth) {
      await page.goto("http://127.0.0.1:3000/settings/privacy").catch(() => {});
      if (original) {
        const current = (await api("/settings")).data.privacy;
        if (current.facialAnalysisEnabled !== original.facialAnalysisEnabled)
          await api("/settings/privacy", {
            method: "PATCH",
            data: {
              journalAiAnalysisEnabled: current.journalAiAnalysisEnabled,
              buddyHistoryEnabled: current.buddyHistoryEnabled,
              facialAnalysisEnabled: original.facialAnalysisEnabled,
              crisisSupportVisible: current.crisisSupportVisible,
              lockScreenPrivate: current.lockScreenPrivate,
            },
          });
      }
      if (ownDraft) {
        const draft = (await api("/journals/draft")).data;
        if (draft?.title === title && draft?.body === body) {
          await api(
            "/journals/draft" +
              (draft.submission_key
                ? "?submissionKey=" + draft.submission_key
                : ""),
            { method: "DELETE" },
          );
          console.log("Removed only the temporary lifecycle draft");
        }
      }
    }
    await browser.close();
  }
})();

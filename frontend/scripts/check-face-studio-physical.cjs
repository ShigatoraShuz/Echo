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
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({
    permissions: ["camera"],
    viewport: { width: 1536, height: 960 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  let auth = "",
    originalFace = null,
    draft = null,
    saveResponse = null;
  const errors = [],
    evaluations = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (
      r.url().startsWith("http://127.0.0.1:4200/") &&
      r.headers().authorization
    )
      auth = r.headers().authorization;
  });
  page.on("response", async (r) => {
    if (r.url().endsWith("/journals/face/evaluate")) {
      const body = await r.json().catch(() => null);
      evaluations.push({
        http: r.status(),
        status: body?.data?.status,
        prediction: body?.data?.prediction,
      });
      console.log("Live face model", r.status(), body?.data?.status);
    }
    if (
      r.url() === "http://127.0.0.1:4200/api/v1/journals" &&
      r.request().method() === "POST"
    )
      saveResponse = await r.json();
  });
  const api = async (path, options = {}) => {
    const response = await page.request.fetch(
      "http://127.0.0.1:4200/api/v1" + path,
      { ...options, headers: { authorization: auth, ...options.headers } },
    );
    if (!response.ok()) throw Error(path + " returned " + response.status());
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
    const settings = await api("/settings");
    originalFace = settings.data.privacy.facialAnalysisEnabled;
    draft = (await api("/journals/draft")).data;
    console.log(
      "Initial state",
      JSON.stringify({
        faceEnabled: originalFace,
        journalAnalysis: settings.data.privacy.journalAiAnalysisEnabled,
        existingDraft: Boolean(draft?.title?.trim() || draft?.body?.trim()),
      }),
    );
    if (!settings.data.privacy.journalAiAnalysisEnabled)
      throw Error(
        "Journal analysis consent is off; not changing that consent automatically.",
      );
    const toggle = page.getByRole("switch", {
      name: "Automatic facial analysis",
      exact: true,
    });
    if ((await toggle.getAttribute("aria-checked")) === "true") {
      await toggle.click();
      await page
        .getByRole("button", { name: "Save Privacy", exact: true })
        .click();
      await expect(
        page.getByText("Privacy choices saved.", { exact: true }),
      ).toBeVisible();
    }
    await page.goto("http://127.0.0.1:3000/journal/new");
    await expect(
      page.getByRole("button", { name: "Save reflection", exact: true }),
    ).toBeEnabled();
    await expect(page.locator(".journal-face-studio")).toHaveCount(0);
    await expect(page.getByText("More options", { exact: true })).toHaveCount(
      0,
    );
    console.log("PASS settings off");
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
    await expect(
      page.getByRole("button", { name: "Save reflection", exact: true }),
    ).toBeEnabled();
    await page.locator(".journal-face-studio").waitFor();
    const hasDraft = Boolean(draft?.title?.trim() || draft?.body?.trim());
    if (!hasDraft) {
      await page
        .getByLabel("Reflection title")
        .fill("Fictional live mesh verification");
      await page
        .getByLabel("Start writing", { exact: true })
        .fill(
          "This is a fictional software verification entry. I enjoyed a peaceful walk, took time to rest, and appreciated the quiet afternoon.",
        );
    }
    await expect(page.locator(".face-studio-viewport")).toHaveAttribute(
      "data-tracking",
      "true",
      { timeout: 45000 },
    );
    console.log("PASS real webcam landmarks");
    const hiddenVideo = await page
      .locator("video")
      .evaluate((v) => ({
        opacity: getComputedStyle(v).opacity,
        width: v.getBoundingClientRect().width,
        height: v.getBoundingClientRect().height,
        trackState: v.srcObject?.getVideoTracks()[0]?.readyState,
        label: v.srcObject?.getVideoTracks()[0]?.label,
      }));
    if (
      hiddenVideo.opacity !== "0" ||
      hiddenVideo.width > 1 ||
      hiddenVideo.height > 1
    )
      throw Error("Raw video is not hidden");
    const mesh = await page.locator(".face-studio-canvas").evaluate((c) => {
      const data = c
        .getContext("2d")
        .getImageData(0, 0, c.width, c.height).data;
      let pixels = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i]) pixels++;
      return { width: c.width, height: c.height, paintedPixels: pixels };
    });
    if (mesh.paintedPixels < 1000) throw Error("Mesh canvas is empty");
    await page.waitForFunction(
      () =>
        document
          .querySelector(".face-studio-result p")
          ?.textContent?.includes("expression signal"),
      {},
      { timeout: 70000 },
    );
    await page.screenshot({
      path: out + "/physical-mesh.png",
      animations: "disabled",
    });
    console.log("PASS real face model inference");
    if (!hasDraft) {
      await page
        .getByRole("button", { name: "Save reflection", exact: true })
        .click();
      await page.waitForURL(/\/journal\/[a-f0-9-]+$/, { timeout: 100000 });
      if (!saveResponse?.data?.journalId) throw Error("Journal was not saved");
      const saved = (
        await api("/journals/" + saveResponse.data.journalId + "/face")
      ).data;
      if (saved.result?.status !== "available")
        throw Error("Saved face result unavailable");
      console.log("PASS saved face result", saved.result.prediction);
    } else {
      await page.goto("http://127.0.0.1:3000/settings/privacy");
      console.log("Existing user draft preserved; did not submit it.");
    }
    fs.writeFileSync(
      out + "/physical-verification.json",
      JSON.stringify(
        {
          physicalCamera: true,
          fakeDevices: false,
          hiddenVideo,
          mesh,
          evaluations,
          savedJournalId: saveResponse?.data?.journalId ?? null,
          draftPreserved: hasDraft,
          errors,
        },
        null,
        2,
      ),
    );
    if (errors.length) throw Error(errors.join(";"));
    console.log("PASS physical face studio");
  } catch (e) {
    console.error(e);
    console.log((await page.locator("body").innerText()).slice(-1800));
    await page
      .screenshot({ path: out + "/failure.png", animations: "disabled" })
      .catch(() => {});
    process.exitCode = 1;
  } finally {
    if (originalFace !== null && auth) {
      const current = await api("/settings").catch(() => null);
      if (
        current &&
        current.data.privacy.facialAnalysisEnabled !== originalFace
      ) {
        const p = current.data.privacy;
        await api("/settings/privacy", {
          method: "PATCH",
          data: {
            journalAiAnalysisEnabled: p.journalAiAnalysisEnabled,
            buddyHistoryEnabled: p.buddyHistoryEnabled,
            facialAnalysisEnabled: originalFace,
            crisisSupportVisible: p.crisisSupportVisible,
            lockScreenPrivate: p.lockScreenPrivate,
          },
        });
      }
    }
    await browser.close();
  }
})();

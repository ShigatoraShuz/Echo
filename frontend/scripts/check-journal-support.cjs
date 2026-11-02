const fs = require("node:fs"),
  { createRequire } = require("node:module"),
  crypto = require("node:crypto");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
if (!process.env.ECHO_TEST_EMAIL || !process.env.ECHO_TEST_PASSWORD)
  throw Error(
    "Set ECHO_TEST_EMAIL and ECHO_TEST_PASSWORD for an intended development test account. This check creates four fictional journals and cleans only those IDs afterward.",
  );
const { chromium, expect } = createRequire(root + "/package.json")(
  "@playwright/test",
);
const out = root + "/artifacts/model-integration/support-checkin-20261102";
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1536, height: 960 },
  });
  page.setDefaultTimeout(25000);
  let auth = "",
    existingDraft = false;
  const created = [],
    checks = [],
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (
      r.url().startsWith("http://127.0.0.1:4200/") &&
      r.headers().authorization
    )
      auth = r.headers().authorization;
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
    await page.goto("http://127.0.0.1:3000/login?next=/journal");
    await page.getByLabel(/^Email address/).fill(process.env.ECHO_TEST_EMAIL);
    await page
      .locator("input[type=password]")
      .fill(process.env.ECHO_TEST_PASSWORD);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.waitForURL("**/journal", { timeout: 90000 });
    await expect.poll(() => Boolean(auth)).toBe(true);
    const draft = (await api("/journals/draft")).data;
    existingDraft = Boolean(draft?.title?.trim() || draft?.body?.trim());
    if (!(await api("/settings")).data.privacy.journalAiAnalysisEnabled)
      throw Error("Journal AI consent is disabled; not changing it.");
    for (let i = 0; i < 4; i++) {
      const title = "Fictional support-flow verification " + i;
      const body =
        i === 0
          ? "Fictional software verification. I enjoyed a peaceful walk today, rested well, appreciated my friends, and felt content with the afternoon."
          : "Fictional software verification text: I want to die and I need help. This is an engineering test entry, not a personal statement.";
      let id;
      if (!existingDraft) {
        await page.goto("http://127.0.0.1:3000/journal/new");
        const dialog = page.getByRole("dialog");
        if (await dialog.count()) await page.keyboard.press("Escape");
        await expect(
          page.getByRole("button", { name: "Save reflection", exact: true }),
        ).toBeEnabled();
        await page.getByLabel("Reflection title").fill(title);
        await page.getByLabel("Start writing", { exact: true }).fill(body);
        const response = page.waitForResponse(
          (r) =>
            r.url() === "http://127.0.0.1:4200/api/v1/journals" &&
            r.request().method() === "POST",
          { timeout: 60000 },
        );
        await page
          .getByRole("button", { name: "Save reflection", exact: true })
          .click();
        const saved = await (await response).json();
        id = saved.data.journalId;
      } else {
        const saved = await api("/journals", {
          method: "POST",
          headers: { "Idempotency-Key": crypto.randomUUID() },
          data: {
            title,
            body,
            emotions: [],
            tags: ["software-verification"],
            privacy_status: "private",
            analysis_consent: true,
            facialAnalysisRequested: false,
          },
        });
        id = saved.data.journalId;
      }
      if (!id) throw Error("No saved journal ID");
      created.push(id);
      await page.goto("http://127.0.0.1:3000/journal/" + id);
      await expect
        .poll(
          async () =>
            (await api("/journals/" + id + "/analysis-state")).data.status,
          { timeout: 210000, intervals: [3000, 5000, 10000] },
        )
        .toBe(i === 0 ? "completed" : "safety_action_required");
      const state = (await api("/journal-support/check-in")).data;
      checks.push({ submission: i, eligible: state.eligible });
      if (state.eligible !== (i === 3))
        throw Error("Unexpected eligibility for submission " + i);
      console.log(
        "PASS distinct saved submission",
        i,
        "eligible",
        state.eligible,
      );
      if (i === 1) {
        const priority = page.getByRole("region", {
          name: "Priority support options",
        });
        await expect(priority).toBeVisible();
        await expect(priority.locator('a[href^="tel:"]')).toHaveCount(1);
        await expect(
          priority.getByRole("button", { name: /Talk to a professional/ }),
        ).toBeVisible();
        await page
          .locator(".journal-studio-report")
          .screenshot({ path: out + "/priority-support.png" });
      }
      if (i < 3) {
        await expect(
          page.getByRole("dialog", { name: "Let’s make room for support" }),
        ).toHaveCount(0);
        await page.waitForTimeout(12000);
      }
    }
    const offer = page.getByRole("dialog", {
      name: "Let’s make room for support",
    });
    await expect(offer).toBeVisible({ timeout: 30000 });
    await page.screenshot({ path: out + "/support-invitation.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(offer).toBeVisible();
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    )
      throw Error("Mobile overflow");
    await page.screenshot({
      path: out + "/mobile-invitation.png",
      fullPage: true,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const motion = await page
      .locator(".support-art-core")
      .evaluate((e) => getComputedStyle(e).animationName);
    if (motion !== "none") throw Error("Reduced motion not respected");
    await page.setViewportSize({ width: 1536, height: 960 });
    await page.keyboard.press("Escape");
    await expect(offer).toBeVisible();
    await expect(page.getByRole("button", { name: "Close dialog" })).toHaveCount(0);
    await expect(page.getByText("Stay with my journal for now", { exact: true })).toHaveCount(0);
    await page.reload();
    await expect(offer).toBeVisible();
    await offer.getByRole("button", { name: /Talk to a professional/ }).click();
    await page.waitForURL("**/professional-support");
    await expect(
      page.getByRole("dialog", { name: "Support is ready" }),
    ).toHaveCount(0);
    console.log(
      "PASS professional navigation without submitting a real request",
    );
    await page.goto("http://127.0.0.1:3000/journal/new");
    const welcome = page.getByRole("dialog", {
      name: "A softer place to begin again",
    });
    await expect(welcome).toBeVisible();
    await expect(
      page.getByText(/You made space to explore support/),
    ).toBeVisible();
    await expect(
      page.getByText(/Your support request was submitted/),
    ).toHaveCount(0);
    await page.screenshot({ path: out + "/return-welcome.png" });
    await page
      .getByRole("button", {
        name: "Take another grounding pause",
        exact: true,
      })
      .click();
    await page.waitForURL("**/tools/grounding");
    let simulatedSave = false;
    await page.route("**/api/v1/grounding/sessions", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      simulatedSave = true;
      await route.fulfill({
        json: {
          success: true,
          data: {
            id: crypto.randomUUID(),
            completedAt: new Date().toISOString(),
            completedSessions: 1,
          },
        },
      });
    });
    await page.clock.install();
    const start = page.getByRole("button", { name: /^Start / }).first();
    await start.click();
    await page.clock.fastForward(601000);
    await expect.poll(() => simulatedSave).toBe(true);
    await page.goto("http://127.0.0.1:3000/journal/new");
    await expect(welcome).toBeVisible();
    await expect(
      page.getByText(/You made time for a grounding practice/),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /I’m ready to write/ })).toBeDisabled();
    await page.getByRole("checkbox", { name: /I feel ready to continue writing/ }).check();
    await page.getByRole("button", { name: /I’m ready to write/ }).click();
    await expect(welcome).toHaveCount(0);
    await expect(
      page.getByLabel("Start writing", { exact: true }),
    ).toBeEditable();
    console.log(
      "PASS accelerated exercise completion and return acknowledgement",
    );
    if (errors.length) throw Error(errors.join("; "));
    fs.writeFileSync(
      out + "/verification.json",
      JSON.stringify(
        {
          realJournalSubmissions: !existingDraft,
          existingDraftPreserved: true,
          actualModelFlags: true,
          eligibility: checks,
          priorityContact: true,
          professionalNavigation: true,
          noProfessionalRequestSent: true,
          groundingCompletion:
            "accelerated browser timer; save response mocked; no practice record created",
          returnWelcome: true,
          requiredChoiceSurvivesReload: true,
          readinessAcknowledgementRequired: true,
          reducedMotion: true,
          mobileOverflow: false,
          errors,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error);
    await page.screenshot({ path: out + "/failure.png", fullPage: true });
    process.exitCode = 1;
  } finally {
    for (const id of created) {
      try {
        const entry = (await api("/journals/" + id)).data;
        if (!entry.title.startsWith("Fictional support-flow verification "))
          throw Error("Unexpected title; refusing cleanup");
        await api("/journals/" + id, { method: "DELETE" });
      } catch (e) {
        console.error("Test cleanup", id, e.message);
        process.exitCode = 1;
      }
    }
    if (!existingDraft) {
      try {
        const draft = (await api("/journals/draft")).data;
        if (draft?.title?.startsWith("Fictional support-flow verification "))
          await api("/journals/draft", { method: "DELETE" });
      } catch (e) {
        console.error("Draft cleanup", e.message);
      }
    }
    console.log("Cleaned only", created.length, "fictional test journals");
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

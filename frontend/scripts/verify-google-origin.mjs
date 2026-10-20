import { chromium } from "@playwright/test";

const origin = new URL(process.env.ECHO_WEB_ORIGIN ?? "http://127.0.0.1:3000").origin;
const loginUrl = new URL("/login", origin).toString();
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  const buttonResponse = page.waitForResponse(
    (response) => response.url().startsWith("https://accounts.google.com/gsi/button?"),
    { timeout: 25_000 },
  );

  await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 25_000 });
  const response = await buttonResponse;
  const clientId = new URL(response.url()).searchParams.get("client_id") ?? "missing";

  if (response.status() !== 200) {
    throw new Error(
      `Google rejected ${origin} for OAuth Web client ${clientId} (HTTP ${response.status()}). ` +
      "In Google Cloud, open this exact client ID and add the origin under Authorized JavaScript origins. " +
      "Save the change, then rerun this check. The frontend and backend must use that same client ID.",
    );
  }

  console.log(`Google accepts ${origin} for OAuth Web client ${clientId}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await browser.close();
}

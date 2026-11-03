import { it } from "vitest";
it.skipIf(process.env.ECHO_VERIFY_BUDDY_BROWSER !== "true")(
  "checks hands-free Buddy in a real browser with synthetic audio",
  async () => {
    await import("../../scripts/test-buddy-integration-browser.mts");
  },
  180000,
);

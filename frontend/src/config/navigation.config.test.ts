import { describe, expect, it } from "vitest";
import { appNavigation, findActiveNavigation, mobileNavigation } from "./navigation.config";
import { ROUTES } from "./routes.config";

describe("professional support navigation", () => {
  it("keeps the user workspace separate from the professional staff portal", () => {
    expect(appNavigation.map((item) => item.id)).toEqual([
      "dashboard",
      "journal",
      "calendar",
      "buddy",
      "insights",
      "grounding",
      "professional-support",
      "find-help",
      "settings",
    ]);
    expect(findActiveNavigation(appNavigation, "/professional-support/requests/case-id")).toBe("professional-support");
    expect(findActiveNavigation(appNavigation, "/professional")).toBeNull();
  });
});

describe("insights navigation", () => {
  it("opens the overview from desktop and mobile without selecting the preview route", () => {
    expect(appNavigation.find((item) => item.id === "insights")?.href).toBe(ROUTES.insights.index);
    expect(mobileNavigation.find((item) => item.id === "mobile-insights")?.href).toBe(ROUTES.insights.index);
    expect(findActiveNavigation(appNavigation, ROUTES.insights.index)).toBe("insights");
    expect(findActiveNavigation(appNavigation, ROUTES.insights.emotion)).toBe("insights");
    expect(findActiveNavigation(appNavigation, "/insights-preview")).toBeNull();
  });
});

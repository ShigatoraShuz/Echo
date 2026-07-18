import { describe, expect, it } from "vitest";

import { LANDING_HERO_CONTENT, LANDING_PAGE_METADATA } from "./landing.model";

describe("landing content model", () => {
  it("defines a complete hero without embedding JSX in the model", () => {
    expect(LANDING_HERO_CONTENT.actions).toHaveLength(2);
    expect(LANDING_HERO_CONTENT.stats).toHaveLength(3);
    expect(LANDING_HERO_CONTENT.stats.map((stat) => stat.icon)).toEqual([
      "privacy",
      "moods",
      "grounding",
    ]);
  });

  it("keeps page metadata aligned with the ECHO landing experience", () => {
    expect(LANDING_PAGE_METADATA.title).toContain("ECHO");
    expect(LANDING_PAGE_METADATA.description).toContain("Private journaling");
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EchoMarketingFooter } from "./echo-marketing-footer";

const landingSensitiveTerms = /crisis|distress|danger|emergency|diagnos(?:is|tic)|high-risk|clinical/i;

describe("EchoMarketingFooter", () => {
  it("keeps the landing variant focused on product features", () => {
    const { container } = render(<EchoMarketingFooter variant="landing" />);

    expect(container.textContent).not.toMatch(landingSensitiveTerms);
    expect(screen.getByRole("link", { name: "Mood check-ins" })).toHaveAttribute("href", "/journal/new");
    expect(screen.getByRole("link", { name: "Grounding tools" })).toHaveAttribute("href", "/tools/grounding");
  });

  it("preserves the default footer content for other routes", () => {
    render(<EchoMarketingFooter />);

    expect(screen.getByRole("link", { name: "Crisis support" })).toHaveAttribute("href", "/crisis-help");
  });
});

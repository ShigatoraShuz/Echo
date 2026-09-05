import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { LandingHowItWorks } from "./landing-how-it-works";

describe("LandingHowItWorks", () => {
  it("starts on the mood check-in and uses an existing route", () => {
    render(<LandingHowItWorks />);

    expect(screen.getByRole("tab", { name: /01 check in/i }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("heading", { name: /start with how you feel/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Try a check-in" }).getAttribute("href")).toBe("/journal/new");
  });

  it("updates the content and CTA when a step is selected", async () => {
    const user = userEvent.setup();
    render(<LandingHowItWorks />);

    await user.click(screen.getByRole("tab", { name: /03 reflect with buddy/i }));
    expect(screen.getByRole("heading", { name: /add another perspective/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Meet Buddy" }).getAttribute("href")).toBe("/buddy");
  });

  it("supports arrow, home, and end keys", async () => {
    const user = userEvent.setup();
    render(<LandingHowItWorks />);

    const first = screen.getByRole("tab", { name: /01 check in/i });
    first.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /02 write privately/i }).getAttribute("aria-selected")).toBe("true");
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: /05 choose a next step/i }).getAttribute("aria-selected")).toBe("true");
    await user.keyboard("{Home}");
    expect(first.getAttribute("aria-selected")).toBe("true");
  });
});

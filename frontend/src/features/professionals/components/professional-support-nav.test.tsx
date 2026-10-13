import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProfessionalSupportNav } from "./professional-support-nav";

vi.mock("next/navigation", () => ({ usePathname: () => "/professional-support/messages" }));

describe("ProfessionalSupportNav", () => {
  it("links every user support section and marks the active page", () => {
    render(<ProfessionalSupportNav />);
    const expected = [
      ["Overview", "/professional-support"],
      ["Find Professionals", "/professional-support/discover"],
      ["My Requests", "/professional-support/requests"],
      ["Messages", "/professional-support/messages"],
      ["Appointments", "/professional-support/appointments"],
      ["Support History", "/professional-support/history"],
    ];
    for (const [name, href] of expected) expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    expect(screen.getByRole("link", { name: "Messages" })).toHaveAttribute("aria-current", "page");
  });
});

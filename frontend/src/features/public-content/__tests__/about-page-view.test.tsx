import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AboutPageView } from "@/features/public-content";

describe("AboutPageView", () => {
  it("presents the public product story without implementation terminology", () => {
    render(<AboutPageView />);

    expect(screen.getByRole("heading", { level: 1, name: /a quieter place to understand yourself/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /reflection, made gentler/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /what echo doesn’t do/i })).toBeTruthy();
    expect(screen.queryByText(/mock data|route-ready|fastapi/i)).toBeNull();
  });

  it("uses the existing destinations for primary actions", () => {
    render(<AboutPageView />);

    expect(screen.getByRole("link", { name: "Start reflecting" }).getAttribute("href")).toBe("/journal/new");
    expect(screen.getByRole("link", { name: "See how it works" }).getAttribute("href")).toBe("/#how-it-works");
    expect(screen.getByRole("link", { name: "Start privately" }).getAttribute("href")).toBe("/signup");
    expect(screen.getByRole("link", { name: "Explore features" }).getAttribute("href")).toBe("/#features");
  });
});

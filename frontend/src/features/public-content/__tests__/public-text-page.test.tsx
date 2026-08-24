import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PublicTextPage, PolicyBlock } from "@/features/public-content";

vi.mock("@/shared/components/ui", () => ({
  EchoImage: () => <div data-testid="echo-image" />,
}));

describe("public-content", () => {
  it("renders the page shell with the supplied title and children", () => {
    render(
      <PublicTextPage title="Privacy" description="A calm privacy page" imageKey="therapistPortrait" >
        <div>Child content</div>
      </PublicTextPage>,
    );

    expect(screen.getByRole("heading", { name: "Privacy" })).toBeTruthy();
    expect(screen.getByText("A calm privacy page")).toBeTruthy();
    expect(screen.getByText("Child content")).toBeTruthy();
  });

  it("renders a policy block title and content", () => {
    render(
      <PolicyBlock title="Data use">
        <p>We keep this private.</p>
      </PolicyBlock>,
    );

    expect(screen.getByRole("heading", { name: "Data use" })).toBeTruthy();
    expect(screen.getByText("We keep this private.")).toBeTruthy();
  });
});

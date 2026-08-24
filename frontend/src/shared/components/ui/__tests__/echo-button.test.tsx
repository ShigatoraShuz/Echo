import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EchoButton } from "../echo-button";

describe("EchoButton", () => {
  it("renders loading state and disables the button", () => {
    render(
      <EchoButton isLoading loadingText="Saving...">
        Save
      </EchoButton>,
    );

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(screen.getByText("Saving...")).toBeTruthy();
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "jest-axe";
import { ProfessionalCasePreview } from "./professional-case-preview";

const calls = vi.hoisted(() => ({ caseDetail: vi.fn(), addNote: vi.fn(), close: vi.fn() }));
vi.mock("@/services/professionals/professional-api", () => ({ professionalApi: calls }));

describe("isolated Sprint 3 preview", () => {
  it("uses fictional shared components with inert mutations and no live requests", async () => {
    const { container } = render(<main><ProfessionalCasePreview organizationId="synthetic-org" /></main>);
    await userEvent.click(screen.getByText("Inspect synthetic case workspace"));
    await screen.findByText("Fictional journal snapshot");
    expect(screen.getByRole("button", { name: "Save note" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("New case note"), { target: { value: "x" } });
    expect(screen.getByRole("alert")).toHaveTextContent("between 2 and 4,000");
    expect(screen.getByRole("button", { name: "Transfer case unavailable" })).toBeDisabled();
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole("button", { name: "Inspect closure confirmation" }));
    expect(screen.getByRole("dialog", { name: "Close this case?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm closure" })).toBeDisabled();
    expect(await axe(document.body)).toHaveNoViolations();
    await userEvent.keyboard("{Escape}");
    expect(calls.caseDetail).not.toHaveBeenCalled(); expect(calls.addNote).not.toHaveBeenCalled(); expect(calls.close).not.toHaveBeenCalled();
  });
  it("demonstrates expired and revoked sharing while clearing drafts and snapshots", async () => {
    render(<ProfessionalCasePreview organizationId="synthetic-org" />);
    await userEvent.click(screen.getByText("Inspect synthetic case workspace"));
    const editor = await screen.findByLabelText("New case note"); fireEvent.change(editor, { target: { value: "Fictional draft" } });
    await userEvent.selectOptions(screen.getByLabelText("Synthetic sharing state"), "expired");
    expect(screen.getByText("Sharing expired")).toBeInTheDocument(); expect(screen.queryByText("Fictional journal snapshot")).not.toBeInTheDocument(); expect(editor).toHaveValue("");
    await userEvent.selectOptions(screen.getByLabelText("Synthetic sharing state"), "revoked"); expect(screen.getByText("Sharing revoked")).toBeInTheDocument();
  });
  it("resets synthetic context and drafts when changing organizations", async () => {
    const { rerender } = render(<ProfessionalCasePreview organizationId="synthetic-one" />);
    await userEvent.click(screen.getByText("Inspect synthetic case workspace"));
    fireEvent.change(await screen.findByLabelText("New case note"), { target: { value: "Fictional draft" } });
    rerender(<ProfessionalCasePreview organizationId="synthetic-two" />);
    await waitFor(() => expect(screen.getByLabelText("New case note")).toHaveValue(""));
    expect(screen.queryByText("synthetic-one")).not.toBeInTheDocument(); expect(screen.getByText("synthetic-two")).toBeInTheDocument();
  });
});

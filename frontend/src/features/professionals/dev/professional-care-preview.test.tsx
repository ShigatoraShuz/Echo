import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "jest-axe";
import { ProfessionalCarePreview } from "./professional-care-preview";

const calls = vi.hoisted(() => ({ proposeAppointment: vi.fn(), cancelAppointment: vi.fn(), addReferral: vi.fn(), caseDetail: vi.fn(), list: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn() }));
vi.mock("@/services/professionals/professional-api", () => ({ professionalApi: calls }));
vi.mock("@/services/notifications/notifications.service", () => ({ notificationsService: calls }));

describe("Sprint 4 synthetic preview isolation", () => {
  it("uses shared agenda, task, referral and notification components without live APIs or mutations", async () => {
    const { container } = render(<main><ProfessionalCarePreview organizationId="fictional-org" /></main>);
    await userEvent.click(screen.getByText("Inspect synthetic care coordination")); await screen.findByText("Fictional meeting instructions");
    expect(screen.getByRole("button", { name: "Cancel appointment" })).toBeDisabled(); expect(screen.getByRole("button", { name: "Record referral" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Complete task unavailable" })).toBeDisabled(); expect(screen.getAllByRole("button", { name: "Mark read unavailable" }).every((button) => button.hasAttribute("disabled"))).toBe(true);
    fireEvent.change(screen.getByLabelText("Starts"), { target: { value: "2099-10-20T10:00" } }); fireEvent.change(screen.getByLabelText("Ends"), { target: { value: "2099-10-20T11:00" } });
    await userEvent.click(screen.getByRole("button", { name: "Review appointment proposal" })); expect(screen.getByRole("button", { name: "Send proposal" })).toBeDisabled();
    expect(await axe(document.body)).toHaveNoViolations(); await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Inspect cancellation confirmation" })); expect(screen.getByRole("button", { name: "Confirm cancellation" })).toBeDisabled(); await userEvent.keyboard("{Escape}");
    expect(await axe(container)).toHaveNoViolations(); for (const call of Object.values(calls)) expect(call).not.toHaveBeenCalled();
  });
  it("demonstrates upcoming, past, canceled, pending/completed and read/unread fixtures honestly", async () => {
    render(<ProfessionalCarePreview organizationId="fictional-org" />); await userEvent.click(screen.getByText("Inspect synthetic care coordination"));
    await screen.findByText("Fictional meeting instructions"); await userEvent.click(screen.getByRole("button", { name: "Past" })); expect(screen.getByText("confirmed")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Canceled" })); expect(screen.getByText("canceled")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Completed" })); expect(screen.getByText("Review agreed next steps")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Unread" })); expect(screen.queryByText("A fictional appointment changed.")).not.toBeInTheDocument(); expect(screen.getByText("A fictional case was updated.")).toBeInTheDocument();
  });
  it.each(["loading", "empty", "error"])("hides previous fixture content in the %s scenario", async (state) => {
    render(<ProfessionalCarePreview organizationId="fictional-org" />); await userEvent.click(screen.getByText("Inspect synthetic care coordination")); await screen.findByText("Fictional meeting instructions");
    await userEvent.selectOptions(screen.getByLabelText("Synthetic care state"), state);
    expect(screen.queryByText("Fictional meeting instructions")).not.toBeInTheDocument(); expect(screen.queryByText("A fictional case was updated.")).not.toBeInTheDocument(); expect(screen.queryByText("Prepare for consultation")).not.toBeInTheDocument();
  });
  it("resets forms, filters and confirmation on organization changes", async () => {
    const { rerender } = render(<ProfessionalCarePreview organizationId="fictional-one" />); await userEvent.click(screen.getByText("Inspect synthetic care coordination"));
    fireEvent.change(await screen.findByLabelText("Resource name"), { target: { value: "Fictional draft" } }); await userEvent.click(screen.getByRole("button", { name: "Inspect cancellation confirmation" }));
    rerender(<ProfessionalCarePreview organizationId="fictional-two" />); expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(screen.getByLabelText("Resource name")).toHaveValue("");
  });
});

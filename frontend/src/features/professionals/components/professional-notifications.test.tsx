import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "jest-axe";
import { ProfessionalNotifications, type SyntheticProfessionalNotification } from "./professional-notifications";

const items: SyntheticProfessionalNotification[] = [
  { id: "one", organizationId: "org-one", kind: "case_updated", createdAt: "2026-10-12T10:00:00Z", readAt: null },
  { id: "two", organizationId: "org-one", kind: "appointment_changed", createdAt: "2026-10-13T10:00:00Z", readAt: "2026-10-13T11:00:00Z" },
  { id: "foreign", organizationId: "org-two", kind: "follow_up", createdAt: "2026-10-13T10:00:00Z", readAt: null },
];
describe("FE-024 isolated professional notifications", () => {
  it("shows no real notifications or invented unread count without integration", () => {
    render(<ProfessionalNotifications />); expect(screen.getByText(/No unread count or notification history/)).toBeInTheDocument(); expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
  it("orders and filters synthetic read/unread states without mutating them", async () => {
    const { container } = render(<ProfessionalNotifications preview={{ organizationId: "org-one", notifications: items }} />);
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("appointment changed"); expect(screen.queryByText("A fictional follow-up is due.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark read unavailable" })).toBeDisabled(); await userEvent.click(screen.getByRole("button", { name: "Unread" })); expect(screen.getAllByRole("listitem")).toHaveLength(1); expect(items[0].readAt).toBeNull(); expect(await axe(container)).toHaveNoViolations();
  });
  it("does not display free-text titles, messages, resource labels or sensitive extras", () => {
    render(<ProfessionalNotifications preview={{ organizationId: "org-one", notifications: [{ ...items[0], title: "Private journal title", message: "Private case note", resourceLabel: "Private assessment", body: "Private plaintext" } as SyntheticProfessionalNotification] }} />);
    expect(screen.queryByText(/Private/)).not.toBeInTheDocument(); expect(screen.getByText("A fictional case was updated.")).toBeInTheDocument();
  });
  it.each(["loading", "empty", "error"] as const)("conceals fixture rows in %s state", (state) => {
    render(<ProfessionalNotifications preview={{ organizationId: "org-one", notifications: items }} state={state} />); expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
  it("drops notifications on organization change", () => {
    const { rerender } = render(<ProfessionalNotifications preview={{ organizationId: "org-one", notifications: items }} />);
    rerender(<ProfessionalNotifications preview={{ organizationId: "empty", notifications: items }} />); expect(screen.queryByText("A fictional case was updated.")).not.toBeInTheDocument(); expect(screen.getByRole("status")).toHaveTextContent("No synthetic notifications");
  });
});

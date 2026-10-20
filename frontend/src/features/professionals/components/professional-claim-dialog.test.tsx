import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "jest-axe";
import type { QueueRequest } from "@/services/professionals/professional-api";
import { ProfessionalClaimDialog } from "./professional-claim-dialog";

const request: QueueRequest = { id: "synthetic-request", organizationId: "synthetic-org", status: "submitted", assignedTo: null, createdAt: "2026-10-13T09:00:00Z", updatedAt: "2026-10-13T09:00:00Z" };
describe("FE-011 claim confirmation presentation", () => {
  it("is accessible, names the request and organization, and preserves consent context", async () => {
    render(<ProfessionalClaimDialog request={request} organizationName="Synthetic organization" onClose={vi.fn()} onConfirm={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "Accept this request?" });
    expect(dialog).toHaveTextContent("Synthetic organization");
    expect(dialog).toHaveTextContent("synthetic-request");
    expect(dialog).toHaveTextContent("Acceptance does not expand the user's consent.");
    expect(await axe(dialog, { rules: { "color-contrast": { enabled: false } } })).toHaveNoViolations();
  });

  it("keeps synthetic preview confirmation disabled and allows keyboard dismissal", async () => {
    const onConfirm = vi.fn(); const onClose = vi.fn();
    render(<ProfessionalClaimDialog request={request} organizationName="Synthetic organization" onClose={onClose} onConfirm={onConfirm} preview />);
    expect(screen.getByRole("button", { name: "Confirm acceptance" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Confirm acceptance" }));
    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";
import type { Membership } from "@/services/professionals/professional-api";
import { ProfessionalOrganizationChooser, ProfessionalOrganizationSelect } from "./professional-organization-selector";

const first: Membership = {
  id: "first", organizationId: "org-first", organization: { id: "org-first", slug: "synthetic", name: "Synthetic Care Organization", status: "active", description: "", serviceHours: "Weekdays" },
  role: "counselor", status: "active", accessState: "active", displayName: "Synthetic Professional", credentialLabel: "Synthetic credential", credentialExpiresAt: "2099-12-31",
};
const second: Membership = { ...first, id: "second", organizationId: "org-second", role: "coordinator", organization: { ...first.organization!, id: "org-second", name: "Synthetic Organization With a Long Name for Responsive Layout Review" } };

describe("professional organization selection", () => {
  it("indicates the only approved organization without offering a redundant switch", () => {
    render(<ProfessionalOrganizationSelect memberships={[first]} organizationId={first.organizationId} onChange={vi.fn()} />);
    const select = screen.getByRole("combobox", { name: "Active organization" });
    expect(select).toHaveValue(first.organizationId);
    expect(select).toBeDisabled();
    expect(select).toHaveAccessibleDescription("Counselor · Approved · Only organization");
  });

  it("uses native labeled selection and shows role/current context for multiple organizations", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<ProfessionalOrganizationSelect memberships={[first, second]} organizationId={first.organizationId} onChange={onChange} />);
    const select = screen.getByRole("combobox", { name: "Active organization" });
    expect(select).toBeEnabled();
    await userEvent.setup().selectOptions(select, second.organizationId);
    expect(onChange).toHaveBeenCalledWith(second.organizationId);
    rerender(<ProfessionalOrganizationSelect memberships={[first, second]} organizationId={second.organizationId} onChange={onChange} />);
    expect(select).toHaveValue(second.organizationId);
    expect(select).toHaveAccessibleDescription("Coordinator · Approved");
  });

  it.each(["pending_membership", "pending_organization", "suspended_membership", "suspended_organization", "credential_expired"] as const)("does not offer %s memberships", async (accessState) => {
    const denied = { ...second, accessState };
    const onChange = vi.fn();
    render(<ProfessionalOrganizationChooser memberships={[first, denied]} onChange={onChange} />);
    const button = screen.getByRole("button", { name: /Synthetic Organization With a Long Name/ });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole("button", { name: /Synthetic Care Organization/ }));
    expect(onChange).toHaveBeenCalledWith(first.organizationId);
  });

  it.each([
    { ...first, organization: null }, { ...first, organization: { ...first.organization!, status: "suspended" } },
    { ...first, status: "suspended" },
  ])("fails closed for unavailable or inconsistent membership metadata", (member) => {
    const onChange = vi.fn();
    render(<ProfessionalOrganizationSelect memberships={[member]} organizationId={member.organizationId} onChange={onChange} />);
    const select = screen.getByRole("combobox", { name: "Active organization" });
    expect(select).toBeDisabled();
    expect(screen.getByRole("option", { name: "No approved organizations" })).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "forged-organization" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows loading and empty states without reporting approval", () => {
    const { rerender } = render(<ProfessionalOrganizationSelect onChange={vi.fn()} />);
    const select = screen.getByRole("combobox", { name: "Active organization" });
    expect(select).toBeDisabled();
    expect(select).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("option", { name: "Loading organizations…" })).toBeInTheDocument();
    rerender(<ProfessionalOrganizationSelect memberships={[]} onChange={vi.fn()} />);
    expect(screen.getByRole("option", { name: "No approved organizations" })).toBeInTheDocument();
  });

  it("blocks forged selections and switching while another action is busy", () => {
    const onChange = vi.fn();
    const { rerender } = render(<ProfessionalOrganizationSelect memberships={[first, second]} onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Active organization" }), { target: { value: "not-a-membership" } });
    expect(onChange).not.toHaveBeenCalled();
    rerender(<ProfessionalOrganizationSelect memberships={[first, second]} disabled onChange={onChange} />);
    const select = screen.getByRole("combobox", { name: "Active organization" });
    expect(select).toBeDisabled();
    fireEvent.change(select, { target: { value: second.organizationId } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("marks the active card and supports keyboard activation of another approved organization", async () => {
    const onChange = vi.fn();
    const { container } = render(<ProfessionalOrganizationChooser memberships={[first, second]} organizationId={first.organizationId} onChange={onChange} />);
    expect(screen.getByRole("button", { name: /Synthetic Care Organization/ })).toHaveAttribute("aria-pressed", "true");
    const next = screen.getByRole("button", { name: /Synthetic Organization With a Long Name/ });
    next.focus();
    await userEvent.setup().keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith(second.organizationId);
    expect(await axe(container, { rules: { "color-contrast": { enabled: false } } })).toHaveNoViolations();
  });
});

import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "jest-axe";
import type { QueueRequest } from "@/services/professionals/professional-api";
import { ProfessionalRequestQueue } from "./professional-request-queue";
import { scopedRequestMetadata } from "../professional-request.model";

const rows: QueueRequest[] = [
  { id: "PENDING1-demo", organizationId: "org", status: "submitted", assignedTo: null, createdAt: "2026-10-01T09:00:00Z", updatedAt: "2026-10-01T09:00:00Z" },
  { id: "MYCASE01-demo", organizationId: "org", status: "assigned", assignedTo: "me", createdAt: "2026-10-02T09:00:00Z", updatedAt: "2026-10-03T09:00:00Z" },
  { id: "OTHER001-demo", organizationId: "org", status: "scheduled", assignedTo: "other", createdAt: "2026-10-03T09:00:00Z", updatedAt: "2026-10-03T09:00:00Z" },
];
const props = { organizationId: "org", organizationName: "Synthetic organization", userId: "me", requests: rows, canClaim: true, canOpenCases: true };

describe("FE-009 metadata-only queue", () => {
  it("whitelists permitted fields and never renders or retains confidential case payloads", () => {
    const mixed = [{ ...rows[0], summary: "Private summary", sharedJournals: [{ body: "Private journal" }], notes: [{ body: "Private note" }] }, { ...rows[1], organizationId: "foreign", id: "FOREIGN1" }];
    expect(scopedRequestMetadata(mixed, "org")).toEqual([rows[0]]);
    render(<ProfessionalRequestQueue {...props} requests={mixed} />);
    expect(screen.getByRole("heading", { name: "Request PENDING1" })).toBeInTheDocument();
    for (const text of ["Private summary", "Private journal", "Private note", "FOREIGN1"]) expect(document.body).not.toHaveTextContent(text);
    expect(screen.queryByRole("link", { name: "Open case" })).not.toBeInTheDocument();
  });

  it("renders dates, statuses, assignment IDs, and only own case links with organization context", () => {
    render(<ProfessionalRequestQueue {...props} />);
    expect(document.querySelector(".pro-records")).toHaveTextContent("Assigned: You");
    expect(document.querySelector(".pro-records")).toHaveTextContent("Assigned: Practitioner ID other");
    expect(document.querySelector(".pro-records")).toHaveTextContent("Assigned: Unassigned");
    expect(screen.getByRole("link", { name: "Open case" })).toHaveAttribute("href", "/professional/cases/MYCASE01-demo?organization=org");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByText("Scheduled", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("ID: PENDING1-demo")).not.toBeVisible();
    fireEvent.click(within(screen.getByRole("heading", { name: "Request PENDING1" }).closest("li")!).getByRole("button", { name: "Request details" }));
    expect(screen.getByText("ID: PENDING1-demo")).toBeVisible();
  });

  it("provides loading and genuine empty states without case actions", () => {
    const { rerender } = render(<ProfessionalRequestQueue {...props} requests={null} />);
    expect(screen.getByRole("status", { name: "Loading request queue" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept request" })).not.toBeInTheDocument();
    rerender(<ProfessionalRequestQueue {...props} requests={[]} />);
    expect(screen.getByRole("heading", { name: "No requests in this organization yet." })).toBeInTheDocument();
  });

  it("keeps claim actions unavailable for ineligible roles and preview fixtures", () => {
    const onClaim = vi.fn();
    const { rerender } = render(<ProfessionalRequestQueue {...props} canClaim={false} onClaim={onClaim} />);
    expect(screen.queryByRole("button", { name: "Accept request" })).not.toBeInTheDocument();
    rerender(<ProfessionalRequestQueue {...props} preview onClaim={onClaim} />);
    expect(screen.getByRole("button", { name: "Accept request" })).toBeDisabled();
    expect(within(screen.getByRole("region", { name: "Request queue" })).queryByRole("link")).not.toBeInTheDocument();
    expect(onClaim).not.toHaveBeenCalled();
  });

  it("retains accessible region and control semantics", async () => {
    const { container } = render(<ProfessionalRequestQueue {...props} />);
    expect(await axe(container, { rules: { "color-contrast": { enabled: false } } })).toHaveNoViolations();
  });
});

describe("FE-010 queue controls", () => {
  it("combines search, status, dates and practitioner and clears all controls", async () => {
    const onClaim = vi.fn();
    render(<ProfessionalRequestQueue {...props} onClaim={onClaim} />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search request ID" }), "mycase");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Status" }), "assigned");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Assigned practitioner" }), "me");
    fireEvent.change(screen.getByLabelText("Submitted from"), { target: { value: "2026-10-02" } });
    fireEvent.change(screen.getByLabelText("Submitted through"), { target: { value: "2026-10-02" } });
    expect(screen.getByRole("heading", { name: "Request MYCASE01" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Request PENDING1" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue("all");
    expect(screen.getByRole("combobox", { name: "Assigned practitioner" })).toHaveValue("all");
    expect(screen.getByLabelText("Submitted from")).toHaveValue("");
    expect(screen.getByRole("heading", { name: "Request PENDING1" })).toBeInTheDocument();
    expect(onClaim).not.toHaveBeenCalled();
  });

  it("shows a useful no-result state and the loaded-data limitation", async () => {
    render(<ProfessionalRequestQueue {...props} />);
    await userEvent.type(screen.getByRole("searchbox"), "not-loaded");
    expect(screen.getByRole("heading", { name: "No requests match this view." })).toBeInTheDocument();
    expect(screen.getByText(/apply only to the loaded requests, up to the latest 100/)).toBeInTheDocument();
    expect(screen.getByText(/3 loaded in this organization/)).toHaveTextContent("0 matching requests");
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeEnabled();
  });

  it("sorts the displayed rows and validates date ranges", async () => {
    render(<ProfessionalRequestQueue {...props} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Sort requests" }), "newest");
    expect(screen.getAllByRole("heading", { level: 3 }).map((item) => item.textContent)).toEqual(["Request OTHER001", "Request MYCASE01", "Request PENDING1"]);
    fireEvent.change(screen.getByLabelText("Submitted from"), { target: { value: "2026-10-03" } });
    fireEvent.change(screen.getByLabelText("Submitted through"), { target: { value: "2026-10-01" } });
    expect(screen.getByRole("alert")).toHaveTextContent("End date must be on or after start date.");
    expect(screen.getByLabelText("Submitted through")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
  });
});

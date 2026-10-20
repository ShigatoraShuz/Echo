import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "jest-axe";
import type { CaseDetail } from "@/services/professionals/professional-api";
import { ProfessionalCaseSharing } from "./professional-case-sharing";
import { ProfessionalCaseTimeline } from "./professional-case-timeline";
import { consentLimitedCase } from "../professional-case.model";

const detail: CaseDetail = { viewer: "professional", request: { id: "synthetic", organizationId: "org", assignedTo: "actor", status: "assigned", createdAt: "2026-10-01T08:00:00Z", updatedAt: "2026-10-01T08:00:00Z", summary: "Private shared message", preferredTime: "Private time preference", sharingActive: true, sharedJournalCount: 1 }, sharedJournals: [{ journalId: "snapshot", title: "Private title", body: "Private snapshot" }], notes: [{ id: "note", body: "Restricted professional note", createdAt: "2026-10-02T08:00:00Z" }], appointments: [], referrals: [] };
describe("FE-015 consent-limited information", () => {
  it("shows only authorized message and selected snapshots, with an honest assessment gap", () => {
    render(<ProfessionalCaseSharing detail={detail} />);
    expect(screen.getByText("Private shared message")).toBeInTheDocument();
    expect(screen.getByText("Private snapshot")).toBeInTheDocument();
    expect(screen.getByText(/Assessment results are not available/)).toBeInTheDocument();
  });
  it("handles no returned snapshots and missing message", () => {
    render(<ProfessionalCaseSharing detail={{ ...detail, request: { ...detail.request, summary: null }, sharedJournals: [] }} />);
    expect(screen.getByText("No shared message is available.")).toBeInTheDocument();
    expect(screen.getByText("No journal snapshots were included in this response.")).toBeInTheDocument();
  });
  it("drops shared plaintext on inactive consent while retaining separately authorized notes", () => {
    const projected = consentLimitedCase({ ...detail, request: { ...detail.request, sharingActive: false } });
    expect(projected.request.summary).toBeNull(); expect(projected.request.preferredTime).toBe(""); expect(projected.sharedJournals).toEqual([]);
    expect(projected.notes).toEqual(detail.notes);
    render(<ProfessionalCaseSharing detail={projected} />);
    expect(screen.queryByText(/Private/)).not.toBeInTheDocument();
    expect(screen.getByText(/does not disclose the reason or expiry date/)).toBeInTheDocument();
  });
});
describe("FE-014 timeline presentation", () => {
  it("shows safe chronological metadata and handles empty and loading states", () => {
    const { rerender } = render(<ProfessionalCaseTimeline detail={detail} />);
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([expect.stringContaining("Request submitted"), expect.stringContaining("Case note recorded")]);
    expect(screen.queryByText("Restricted professional note")).not.toBeInTheDocument();
    rerender(<ProfessionalCaseTimeline detail={detail} loading />); expect(screen.getByRole("status")).toHaveTextContent("Loading case activity");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    rerender(<ProfessionalCaseTimeline detail={{ ...detail, request: { ...detail.request, createdAt: "", updatedAt: "" }, notes: [] }} />);
    expect(screen.getByText("No dated activity is available.")).toBeInTheDocument();
  });
});
describe("FE-016 consent states", () => {
  it.each(["expired", "revoked", "unavailable"] as const)("labels fictional %s without showing content", (state) => {
    render(<ProfessionalCaseSharing detail={detail} previewState={state} />);
    expect(screen.queryByText(/Private/)).not.toBeInTheDocument();
    expect(screen.getByText(/Synthetic consent scenario only/)).toBeInTheDocument();
  });
  it("removes rendered shared content as soon as inactive consent arrives", () => {
    const { rerender } = render(<ProfessionalCaseSharing detail={detail} />);
    rerender(<ProfessionalCaseSharing detail={{ ...detail, request: { ...detail.request, sharingActive: false } }} />);
    expect(screen.queryByText(/Private/)).not.toBeInTheDocument();
  });
  it("has accessible active and unavailable content regions", async () => {
    const { container, rerender } = render(<ProfessionalCaseSharing detail={detail} />);
    expect(await axe(container)).toHaveNoViolations();
    rerender(<ProfessionalCaseSharing detail={{ ...detail, request: { ...detail.request, sharingActive: false } }} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

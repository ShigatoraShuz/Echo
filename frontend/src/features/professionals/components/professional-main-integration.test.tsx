import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { ProfessionalCaseMessages } from "./professional-case-messages";
import { ProfessionalAssignmentPanel } from "./professional-assignment-panel";
import { ProfessionalCaseSharing } from "./professional-case-sharing";
import { consentLimitedCase } from "../professional-case.model";
import type { CaseDetail } from "@/services/professionals/professional-api";

const api = vi.hoisted(() => ({ caseMessages: vi.fn(), markCaseMessagesRead: vi.fn(), sendCaseMessage: vi.fn(), directory: vi.fn() }));
vi.mock("@/services/professionals/professional-api", () => ({ professionalApi: api }));
beforeEach(() => {
  vi.clearAllMocks();
  api.caseMessages.mockResolvedValue({ messages: [{ id: "fictional-message", requestId: "case-one", sender: "user", body: "Fictional private conversation", createdAt: "2026-10-01T10:00:00Z" }], nextCursor: null });
  api.markCaseMessagesRead.mockResolvedValue({ read: true });
});
it("loads the authorized conversation and blocks duplicate sends until server acknowledgment", async () => {
  const fail = vi.fn();
  let complete!: () => void;
  api.sendCaseMessage.mockReturnValue(new Promise<void>((resolve) => { complete = resolve; }));
  render(<ProfessionalCaseMessages caseId="case-one" readOnly={false} onFailure={fail} />);
  expect(await screen.findByText("Fictional private conversation")).toBeVisible();
  await userEvent.type(screen.getByLabelText("Case message"), "Fictional clinical reply");
  const form = screen.getByRole("button", { name: "Send message" }).closest("form")!;
  act(() => { fireEvent.submit(form); fireEvent.submit(form); });
  expect(api.sendCaseMessage).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Sending message" })).toBeDisabled();
  expect(screen.queryByText(/received by the server/)).not.toBeInTheDocument();
  await act(async () => complete());
  expect(await screen.findByText(/received by the server/)).toBeVisible();
  expect(fail).not.toHaveBeenCalled();
});
it("conceals wrong-case message responses and delegates access loss to the protected workspace", async () => {
  api.caseMessages.mockResolvedValue({ messages: [{ id: "other", requestId: "another-case", body: "Must never render" }], nextCursor: null });
  const fail = vi.fn();
  render(<ProfessionalCaseMessages caseId="case-one" readOnly onFailure={fail} />);
  await waitFor(() => expect(fail).toHaveBeenCalledTimes(1));
  expect(screen.queryByText("Must never render")).not.toBeInTheDocument();
  expect(api.markCaseMessagesRead).not.toHaveBeenCalled();
  expect(screen.queryByLabelText("Case message")).not.toBeInTheDocument();
});
it("ignores an old conversation after its workspace unmounts", async () => {
  let complete!: (value: unknown) => void;
  api.caseMessages.mockReturnValue(new Promise((resolve) => { complete = resolve; }));
  const fail = vi.fn();
  const view = render(<ProfessionalCaseMessages caseId="case-one" readOnly onFailure={fail} />);
  view.unmount();
  await act(async () => complete({ messages: [], nextCursor: null }));
  expect(api.markCaseMessagesRead).not.toHaveBeenCalled();
  expect(fail).not.toHaveBeenCalled();
});
it("coordinates assignment with scoped directory metadata and an explicit server action", async () => {
  api.directory.mockResolvedValue({ practitioners: [{ id: "profile-one", organizationId: "org-one", role: "counselor", displayName: "Fictional clinician" }, { id: "outside", organizationId: "org-two", role: "counselor", displayName: "Other organization" }] });
  const assign = vi.fn().mockResolvedValue(true);
  render(<ProfessionalAssignmentPanel organizationId="org-one" requests={[{ id: "request-one", organizationId: "org-one", status: "submitted", assignedTo: null, createdAt: "2026-10-01", updatedAt: "2026-10-01" }]} busy={false} onAssign={assign} />);
  await screen.findByRole("option", { name: /Fictional clinician/ });
  expect(screen.queryByRole("option", { name: "Other organization" })).not.toBeInTheDocument();
  expect(assign).not.toHaveBeenCalled();
  await userEvent.selectOptions(screen.getByLabelText("Unassigned request"), "request-one");
  await userEvent.selectOptions(screen.getByLabelText("Practitioner"), "profile-one");
  await userEvent.click(screen.getByRole("button", { name: "Confirm assignment" }));
  expect(assign).toHaveBeenCalledWith("request-one", "profile-one");
  expect(api.directory).toHaveBeenCalledWith({ organizationId: "org-one", limit: 30 });
});
it("clears assessment snapshots when case consent is no longer active", () => {
  const detail = { viewer: "professional", request: { sharingActive: true, summary: "Fictional shared message" }, sharedJournals: [], sharedPhq8: [{ id: "fictional-check-in", label: "Fictional selected check-in", score: 8, severity: "mild", context: "Fictional selected context" }] } as unknown as CaseDetail;
  const view = render(<ProfessionalCaseSharing detail={detail} />);
  expect(screen.getByText("Fictional selected check-in")).toBeVisible();
  view.rerender(<ProfessionalCaseSharing detail={consentLimitedCase({ ...detail, request: { ...detail.request, sharingActive: false } })} />);
  expect(screen.queryByText("Fictional selected check-in")).not.toBeInTheDocument();
  expect(screen.queryByText("Fictional shared message")).not.toBeInTheDocument();
});

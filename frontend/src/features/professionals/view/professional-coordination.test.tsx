import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CaseDetail } from "@/services/professionals/professional-api";
import { AppError } from "@/shared/errors/app-error";
import { ProfessionalCaseView } from "./professional-case-view";

const mocks = vi.hoisted(() => ({ caseDetail: vi.fn(), proposeAppointment: vi.fn(), cancelAppointment: vi.fn(), addReferral: vi.fn(), respondAppointment: vi.fn(), replace: vi.fn(), params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks, useSearchParams: () => mocks.params }));
vi.mock("@/services/professionals/professional-api", () => ({ professionalApi: mocks }));
vi.mock("../components/professional-shell", () => ({ ProfessionalShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>, ProfessionalSkeleton: () => <p>Loading case</p> }));
const fixture: CaseDetail = { viewer: "professional", sharedPhq8: [], appointmentChangeRequests: [], request: { id: "case-one", organizationId: "org-one", assignedTo: "actor-one", status: "assigned", createdAt: "2026-10-01T08:00:00Z", updatedAt: "2026-10-02T08:00:00Z", summary: "Synthetic private message", preferredTime: "", sharingActive: true, preferredProfileId: null, sharedPhq8Count: 0, sharedJournalCount: 0 }, sharedJournals: [], appointments: [], referrals: [], notes: [] };
const appointment = { id: "appointment-one", startsAt: "2099-10-20T10:00:00Z", endsAt: "2099-10-20T11:00:00Z", mode: "online", locationHint: "Synthetic meeting details", status: "proposed" };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((yes) => { resolve = yes; }); return { promise, resolve }; }
function apiError(statusCode: number, code: string) { return new AppError({ statusCode, code: code as AppError["code"], userMessage: "Private database diagnostic" }); }
beforeEach(() => { vi.resetAllMocks(); mocks.params = new URLSearchParams(); mocks.caseDetail.mockResolvedValue(structuredClone(fixture)); });
it("preserves only the agenda period on refresh, resetting it on case navigation", async () => {
  const { rerender } = render(<ProfessionalCaseView id="case-one" />);
  await userEvent.click(await screen.findByRole("button", { name: "Past" }));
  fireEvent.change(screen.getByLabelText("Resource name"), { target: { value: "Unsaved fictional referral" } });
  await userEvent.click(screen.getByRole("button", { name: "Refresh case" }));
  expect(await screen.findByRole("button", { name: "Past" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByLabelText("Resource name")).toHaveValue("");
  mocks.caseDetail.mockResolvedValue({ ...fixture, request: { ...fixture.request, id: "case-two" } });
  rerender(<ProfessionalCaseView id="case-two" />);
  expect(await screen.findByRole("button", { name: "Upcoming and in progress" })).toHaveAttribute("aria-pressed", "true");
});
async function reviewProposal() {
  fireEvent.change(await screen.findByLabelText("Starts"), { target: { value: "2099-10-20T10:00" } });
  fireEvent.change(screen.getByLabelText("Ends"), { target: { value: "2099-10-20T11:00" } });
  await userEvent.selectOptions(screen.getByLabelText("Session type"), "online");
  await userEvent.click(screen.getByRole("button", { name: "Review appointment proposal" }));
}
describe("FE-019 real appointment proposals", () => {
  it("validates before confirmation and sends one proposal only after review", async () => {
    const pending = deferred<{ appointmentId: string }>(); mocks.proposeAppointment.mockReturnValue(pending.promise);
    render(<ProfessionalCaseView id="case-one" />);
    await userEvent.click(await screen.findByRole("button", { name: "Review appointment proposal" }));
    expect(screen.getByRole("alert")).toHaveTextContent("valid start and end"); expect(mocks.proposeAppointment).not.toHaveBeenCalled();
    await reviewProposal(); expect(screen.getByRole("dialog")).toHaveTextContent("request owner"); expect(mocks.proposeAppointment).not.toHaveBeenCalled();
    const send = screen.getByRole("button", { name: "Send proposal" }); fireEvent.click(send); fireEvent.click(send);
    expect(mocks.proposeAppointment).toHaveBeenCalledTimes(1); expect(mocks.proposeAppointment).toHaveBeenCalledWith("case-one", { startsAt: new Date("2099-10-20T10:00").toISOString(), endsAt: new Date("2099-10-20T11:00").toISOString(), mode: "online", locationHint: "" });
    expect(screen.queryByText(/Appointment proposal recorded/)).not.toBeInTheDocument();
    mocks.caseDetail.mockResolvedValue({ ...fixture, appointments: [appointment] }); await act(async () => pending.resolve({ appointmentId: appointment.id }));
    expect(await screen.findByText(/Appointment proposal recorded/)).toBeInTheDocument(); expect(screen.queryByLabelText("Starts")).not.toBeInTheDocument();
  });
  it("preserves an invalid proposal for correction without raw error details", async () => {
    mocks.proposeAppointment.mockRejectedValue(apiError(400, "VALIDATION_ERROR")); render(<ProfessionalCaseView id="case-one" />); await reviewProposal();
    await userEvent.click(screen.getByRole("button", { name: "Send proposal" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("proposal was not accepted"); expect(screen.getByLabelText("Starts")).toHaveValue("2099-10-20T10:00"); expect(screen.getByRole("alert")).not.toHaveTextContent("Private");
  });
  it.each([[401, "AUTHENTICATION_REQUIRED"], [403, "MFA_REQUIRED"], [403, "RESOURCE_FORBIDDEN"], [409, "APPOINTMENT_CONFLICT"]])("handles %s / %s without stale details or automatic mutation retry", async (status, code) => {
    mocks.proposeAppointment.mockRejectedValue(apiError(Number(status), String(code))); render(<ProfessionalCaseView id="case-one" />); await reviewProposal();
    await userEvent.click(screen.getByRole("button", { name: "Send proposal" })); await screen.findByRole("alert");
    expect(screen.queryByText("Synthetic private message")).not.toBeInTheDocument(); expect(screen.getByRole("alert")).not.toHaveTextContent("Private database"); expect(mocks.proposeAppointment).toHaveBeenCalledTimes(1);
    if (status === 401 || code === "MFA_REQUIRED") expect(mocks.replace).toHaveBeenCalled();
  });
  it("requires an agenda review after an uncertain proposal and never replays it", async () => {
    mocks.proposeAppointment.mockRejectedValue(new TypeError("Network interrupted")); render(<ProfessionalCaseView id="case-one" />); await reviewProposal();
    await userEvent.click(screen.getByRole("button", { name: "Send proposal" })); await screen.findByText(/Proposal receipt could not be confirmed/);
    await userEvent.click(screen.getByRole("button", { name: "Retry" })); expect(await screen.findByLabelText("Starts")).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "I reviewed the agenda; enable a new proposal" })); expect(screen.getByLabelText("Starts")).toBeEnabled(); expect(mocks.proposeAppointment).toHaveBeenCalledTimes(1);
  });
  it("ignores a proposal completion after a case or organization switch", async () => {
    const pending = deferred<{ appointmentId: string }>(); mocks.proposeAppointment.mockReturnValue(pending.promise);
    const { rerender } = render(<ProfessionalCaseView id="case-one" />); await reviewProposal(); await userEvent.click(screen.getByRole("button", { name: "Send proposal" }));
    mocks.params = new URLSearchParams("organization=org-two"); mocks.caseDetail.mockRejectedValue(apiError(403, "RESOURCE_FORBIDDEN")); rerender(<ProfessionalCaseView id="case-two" />);
    await screen.findByRole("alert"); await act(async () => pending.resolve({ appointmentId: "old" }));
    expect(screen.queryByText(/Appointment proposal recorded/)).not.toBeInTheDocument(); expect(mocks.caseDetail).toHaveBeenCalledTimes(2);
  });
});

describe("FE-021 practitioner cancellation", () => {
  it("requires confirmation, prevents duplicate requests, and reflects the refreshed state", async () => {
    mocks.caseDetail.mockResolvedValue({ ...fixture, request: { ...fixture.request, status: "scheduled" }, appointments: [{ ...appointment, status: "confirmed" }] });
    const pending = deferred<unknown>(); mocks.cancelAppointment.mockReturnValue(pending.promise); render(<ProfessionalCaseView id="case-one" />);
    const trigger = await screen.findByRole("button", { name: "Cancel appointment" }); await userEvent.click(trigger); expect(mocks.cancelAppointment).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Keep appointment" })); expect(trigger).toHaveFocus(); await userEvent.click(trigger);
    const confirm = screen.getByRole("button", { name: "Confirm cancellation" }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(mocks.cancelAppointment).toHaveBeenCalledTimes(1); expect(mocks.cancelAppointment).toHaveBeenCalledWith(appointment.id); expect(mocks.respondAppointment).not.toHaveBeenCalled();
    expect(screen.queryByText(/Appointment cancellation confirmed/)).not.toBeInTheDocument();
    mocks.caseDetail.mockResolvedValue({ ...fixture, appointments: [{ ...appointment, status: "canceled" }] }); await act(async () => pending.resolve({ appointmentId: appointment.id, status: "canceled" }));
    await screen.findByText(/Appointment cancellation confirmed/); await userEvent.click(screen.getByRole("button", { name: "Canceled" })); expect(screen.getByText("canceled")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel appointment" })).not.toBeInTheDocument();
  });
  it.each([[401, "AUTHENTICATION_REQUIRED"], [403, "MFA_REQUIRED"], [403, "RESOURCE_FORBIDDEN"], [409, "APPOINTMENT_UNAVAILABLE"]])("handles cancellation %s / %s without exposing old content", async (status, code) => {
    mocks.caseDetail.mockResolvedValue({ ...fixture, appointments: [appointment] }); mocks.cancelAppointment.mockRejectedValue(apiError(Number(status), String(code)));
    render(<ProfessionalCaseView id="case-one" />); await userEvent.click(await screen.findByRole("button", { name: "Cancel appointment" })); await userEvent.click(screen.getByRole("button", { name: "Confirm cancellation" }));
    await screen.findByRole("alert"); expect(screen.queryByText("Synthetic meeting details")).not.toBeInTheDocument(); expect(screen.queryByText("Synthetic private message")).not.toBeInTheDocument(); expect(screen.getByRole("alert")).not.toHaveTextContent("Private database");
    expect(mocks.cancelAppointment).toHaveBeenCalledTimes(1); if (status === 401 || code === "MFA_REQUIRED") expect(mocks.replace).toHaveBeenCalled();
  });
  it("uses a read to recover from an uncertain cancellation without replaying it", async () => {
    mocks.caseDetail.mockResolvedValue({ ...fixture, appointments: [appointment] }); mocks.cancelAppointment.mockRejectedValue(new TypeError("Network failed"));
    render(<ProfessionalCaseView id="case-one" />); await userEvent.click(await screen.findByRole("button", { name: "Cancel appointment" })); await userEvent.click(screen.getByRole("button", { name: "Confirm cancellation" }));
    await screen.findByText(/Cancellation could not be confirmed/); await userEvent.click(screen.getByRole("button", { name: "Retry" })); await screen.findByRole("button", { name: "Cancel appointment" }); expect(mocks.cancelAppointment).toHaveBeenCalledTimes(1);
  });
  it("never offers owner confirmation or a working reschedule action", async () => {
    mocks.caseDetail.mockResolvedValue({ ...fixture, appointments: [appointment] }); render(<ProfessionalCaseView id="case-one" />);
    expect(await screen.findByRole("button", { name: "Rescheduling unavailable" })).toBeDisabled(); expect(screen.queryByRole("button", { name: /Accept appointment|Confirm appointment/ })).not.toBeInTheDocument(); expect(mocks.respondAppointment).not.toHaveBeenCalled();
  });
  it("rejects owner-view data before mounting any practitioner actions", async () => {
    mocks.caseDetail.mockResolvedValue({ ...fixture, viewer: "user", appointments: [appointment] }); render(<ProfessionalCaseView id="case-one" />);
    await screen.findByRole("alert"); expect(screen.queryByRole("button", { name: "Cancel appointment" })).not.toBeInTheDocument(); expect(mocks.cancelAppointment).not.toHaveBeenCalled();
  });
});

async function submitReferral(name = "Synthetic support resource", url = "https://example.invalid/resource") {
  fireEvent.change(await screen.findByLabelText("Resource name"), { target: { value: name } });
  fireEvent.change(screen.getByLabelText("Secure website, optional"), { target: { value: url } });
  fireEvent.submit(screen.getByLabelText("Resource name").closest("form")!);
}
describe("FE-023 real referral recording", () => {
  it("validates fields and records once with acknowledged success only", async () => {
    const pending = deferred<{ referralId: string }>(); mocks.addReferral.mockReturnValue(pending.promise); render(<ProfessionalCaseView id="case-one" />);
    await submitReferral(" x ", "http://example.invalid"); expect(screen.getAllByRole("alert")).toHaveLength(2); expect(mocks.addReferral).not.toHaveBeenCalled();
    await submitReferral("  Synthetic support resource  ", ""); fireEvent.submit(screen.getByLabelText("Resource name").closest("form")!);
    expect(mocks.addReferral).toHaveBeenCalledTimes(1); expect(mocks.addReferral).toHaveBeenCalledWith("case-one", "Synthetic support resource", null); expect(screen.queryByText(/Referral recorded/)).not.toBeInTheDocument();
    await act(async () => pending.resolve({ referralId: "new-referral" })); expect(await screen.findByText("Referral recorded. No external service was contacted.")).toBeInTheDocument(); expect(screen.getByLabelText("Resource name")).toHaveValue("");
  });
  it("retains a rejected referral for correction without raw diagnostics", async () => {
    mocks.addReferral.mockRejectedValue(apiError(400, "VALIDATION_ERROR")); render(<ProfessionalCaseView id="case-one" />); await submitReferral();
    expect(await screen.findByRole("alert")).toHaveTextContent("referral was not accepted"); expect(screen.getByLabelText("Resource name")).toHaveValue("Synthetic support resource"); expect(screen.getByRole("alert")).not.toHaveTextContent("Private database");
  });
  it("requires review after an uncertain result and never replays a referral", async () => {
    mocks.addReferral.mockRejectedValue(new TypeError("Network failed")); render(<ProfessionalCaseView id="case-one" />); await submitReferral();
    await screen.findByText(/Referral receipt could not be confirmed/); await userEvent.click(screen.getByRole("button", { name: "Retry" })); expect(await screen.findByLabelText("Resource name")).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "I reviewed the referrals; enable a new record" })); expect(screen.getByLabelText("Resource name")).toBeEnabled(); expect(mocks.addReferral).toHaveBeenCalledTimes(1);
  });
  it("keeps appointment and referral uncertainty separate until each is reviewed", async () => {
    mocks.proposeAppointment.mockRejectedValue(new TypeError("Network failed")); mocks.addReferral.mockRejectedValue(new TypeError("Network failed"));
    render(<ProfessionalCaseView id="case-one" />); await reviewProposal(); await userEvent.click(screen.getByRole("button", { name: "Send proposal" }));
    await screen.findByText(/Proposal receipt could not be confirmed/); await userEvent.click(screen.getByRole("button", { name: "Retry" })); await screen.findByLabelText("Starts");
    await submitReferral(); await screen.findByText(/Referral receipt could not be confirmed/); await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByLabelText("Resource name")).toBeDisabled(); expect(screen.getByLabelText("Starts")).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "I reviewed the referrals; enable a new record" })); expect(screen.getByLabelText("Resource name")).toBeEnabled(); expect(screen.getByLabelText("Starts")).toBeDisabled();
    expect(mocks.proposeAppointment).toHaveBeenCalledTimes(1); expect(mocks.addReferral).toHaveBeenCalledTimes(1);
  });
  it.each([[401, "AUTHENTICATION_REQUIRED"], [403, "MFA_REQUIRED"], [403, "RESOURCE_FORBIDDEN"], [409, "CASE_CLOSED"]])("conceals case and referral information after %s / %s", async (status, code) => {
    mocks.addReferral.mockRejectedValue(apiError(Number(status), String(code))); render(<ProfessionalCaseView id="case-one" />); await submitReferral(); await screen.findByRole("alert");
    expect(screen.queryByLabelText("Resource name")).not.toBeInTheDocument(); expect(screen.queryByText("Synthetic private message")).not.toBeInTheDocument(); expect(screen.getByRole("alert")).not.toHaveTextContent("Private database");
  });
  it("ignores a late referral result after an organization switch", async () => {
    const pending = deferred<{ referralId: string }>(); mocks.addReferral.mockReturnValue(pending.promise);
    const { rerender } = render(<ProfessionalCaseView id="case-one" />); await submitReferral(); mocks.params = new URLSearchParams("organization=org-two"); mocks.caseDetail.mockRejectedValue(apiError(403, "RESOURCE_FORBIDDEN")); rerender(<ProfessionalCaseView id="case-one" />);
    await screen.findByRole("alert"); await act(async () => pending.resolve({ referralId: "old" })); expect(screen.queryByText(/Referral recorded/)).not.toBeInTheDocument(); expect(mocks.caseDetail).toHaveBeenCalledTimes(2);
  });
});

vi.mock("@/services/experience/experience-api", () => ({ experienceApi: { getSupportResources: async () => [] } }));

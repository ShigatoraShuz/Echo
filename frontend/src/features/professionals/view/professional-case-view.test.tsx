import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CaseDetail } from "@/services/professionals/professional-api";
import { AppError } from "@/shared/errors/app-error";
import { ProfessionalCaseView } from "./professional-case-view";

const mocks = vi.hoisted(() => ({ caseDetail: vi.fn(), addNote: vi.fn(), close: vi.fn(), replace: vi.fn(), params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks, useSearchParams: () => mocks.params }));
vi.mock("@/services/professionals/professional-api", () => ({ professionalApi: mocks }));
vi.mock("../components/professional-shell", () => ({ ProfessionalShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>, ProfessionalSkeleton: () => <p>Loading case details</p> }));

export const fixture: CaseDetail = {
  viewer: "professional", request: { id: "case-one", organizationId: "org-one", assignedTo: "practitioner-one", status: "assigned", createdAt: "2026-10-01T08:00:00Z", updatedAt: "2026-10-02T08:00:00Z", summary: "Synthetic shared message", preferredTime: "Afternoons", sharingActive: true, sharedJournalCount: 1 },
  sharedJournals: [{ journalId: "journal-one", title: "Synthetic reflection", body: "Synthetic private snapshot" }], appointments: [], referrals: [], notes: [],
};
const failure = (statusCode: number) => new AppError({ code: "AUTHORIZATION_ERROR", statusCode, userMessage: "Private diagnostic" });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((yes) => { resolve = yes; }); return { promise, resolve }; }
beforeEach(() => { vi.resetAllMocks(); mocks.params = new URLSearchParams(); mocks.caseDetail.mockResolvedValue(structuredClone(fixture)); });

describe("FE-013 case workspace", () => {
  it("collects an optional closure reason only with backend support and clears it when dismissed", async () => {
    mocks.caseDetail.mockResolvedValue({ ...fixture, closureReasonAvailable: true }); mocks.close.mockResolvedValue({});
    render(<ProfessionalCaseView id="case-one" />);
    await userEvent.click(await screen.findByRole("button", { name: "Close case" }));
    const field = screen.getByLabelText("Closure reason (optional)"); fireEvent.change(field, { target: { value: "x" } });
    expect(screen.getByRole("button", { name: "Confirm closure" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Keep case open" }));
    await userEvent.click(screen.getByRole("button", { name: "Close case" }));
    expect(screen.getByLabelText("Closure reason (optional)")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Closure reason (optional)"), { target: { value: "Synthetic support concluded" } });
    await userEvent.click(screen.getByRole("button", { name: "Confirm closure" }));
    expect(mocks.close).toHaveBeenCalledWith("case-one", "Synthetic support concluded");
  });
  it("uses a submission identifier only when the deployed case service advertises note lifecycle support", async () => {
    mocks.caseDetail.mockResolvedValue({ ...fixture, notesLifecycleAvailable: true, notes: [{ id: "draft", body: "Synthetic draft", state: "draft", createdAt: fixture.request.createdAt }] });
    mocks.addNote.mockResolvedValue({ noteId: "final-note" });
    render(<ProfessionalCaseView id="case-one" />);
    expect(await screen.findByText("Draft · not finalized")).toBeInTheDocument();
    const editor = screen.getByLabelText("New case note"); fireEvent.change(editor, { target: { value: "Synthetic final note" } }); fireEvent.submit(editor.closest("form")!);
    await screen.findByText("Note saved. The server confirmed receipt.");
    expect(mocks.addNote).toHaveBeenCalledWith("case-one", "Synthetic final note", { submissionId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
  });
  it("renders authorized assignment and organization with scoped return links", async () => {
    render(<ProfessionalCaseView id="case-one" />);
    expect(screen.getByText("Loading case details")).toBeInTheDocument();
    await screen.findByText("Synthetic shared message");
    expect(screen.getByText("practitioner-one")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My Cases" })).toHaveAttribute("href", "/professional/my-cases?organization=org-one");
    expect(screen.getByRole("link", { name: "Request queue" })).toHaveAttribute("href", "/professional/requests?organization=org-one");
  });
  it.each([401, 403, 404])("does not reveal details on HTTP %s", async (status) => {
    mocks.caseDetail.mockRejectedValue(failure(status)); render(<ProfessionalCaseView id="case-one" />);
    await screen.findByRole("alert"); expect(screen.queryByText("Synthetic shared message")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).not.toHaveTextContent("Private diagnostic");
  });
  it("rejects owner-view payloads in the professional workspace", async () => {
    mocks.caseDetail.mockResolvedValue({ ...fixture, viewer: "user" }); render(<ProfessionalCaseView id="case-one" />);
    await screen.findByRole("alert"); expect(screen.queryByText("Synthetic shared message")).not.toBeInTheDocument();
  });
  it("rejects a case response for a different request ID", async () => {
    mocks.caseDetail.mockResolvedValue({ ...fixture, request: { ...fixture.request, id: "foreign-case" } });
    render(<ProfessionalCaseView id="case-one" />); await screen.findByRole("alert");
    expect(screen.queryByText("Synthetic shared message")).not.toBeInTheDocument();
  });
  it("clears displayed details and ignores stale responses on organization changes", async () => {
    const pending = deferred<CaseDetail>(); mocks.caseDetail.mockReturnValueOnce(pending.promise).mockRejectedValue(failure(403));
    const { rerender } = render(<ProfessionalCaseView id="case-one" />);
    mocks.params = new URLSearchParams("organization=org-two"); rerender(<ProfessionalCaseView id="case-one" />);
    await screen.findByRole("alert"); await act(async () => pending.resolve(fixture));
    expect(screen.queryByText("Synthetic shared message")).not.toBeInTheDocument();
  });
});

describe("FE-016 consent and sensitive-state clearing", () => {
  it("conceals shared information while refreshing, then renders inactive consent without old plaintext", async () => {
    const pending = deferred<CaseDetail>(); mocks.caseDetail.mockResolvedValueOnce(fixture).mockReturnValue(pending.promise);
    render(<ProfessionalCaseView id="case-one" />); await screen.findByText("Synthetic shared message");
    await userEvent.click(screen.getByRole("button", { name: "Refresh case" }));
    expect(screen.queryByText("Synthetic shared message")).not.toBeInTheDocument();
    await act(async () => pending.resolve({ ...fixture, request: { ...fixture.request, sharingActive: false } }));
    expect(screen.getByText("Sharing is unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Synthetic private snapshot")).not.toBeInTheDocument();
  });
  it("clears drafts and content when hidden and reauthorizes on return", async () => {
    render(<ProfessionalCaseView id="case-one" />); await screen.findByText("Synthetic shared message");
    fireEvent.change(screen.getByLabelText("New case note"), { target: { value: "Sensitive unsaved draft" } });
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    fireEvent(document, new Event("visibilitychange")); expect(screen.queryByText("Synthetic shared message")).not.toBeInTheDocument();
    visibility.mockReturnValue("visible"); fireEvent(document, new Event("visibilitychange"));
    await screen.findByText("Synthetic shared message"); expect(screen.getByLabelText("New case note")).toHaveValue("");
    expect(mocks.caseDetail).toHaveBeenCalledTimes(2); visibility.mockRestore();
  });
  it("clears every private region when refresh loses permission", async () => {
    mocks.caseDetail.mockResolvedValueOnce({ ...fixture, notes: [{ id: "note", body: "Sensitive saved note", createdAt: fixture.request.createdAt }] }).mockRejectedValue(failure(403));
    render(<ProfessionalCaseView id="case-one" />); await screen.findByText("Sensitive saved note");
    await userEvent.click(screen.getByRole("button", { name: "Refresh case" })); await screen.findByRole("alert");
    expect(screen.queryByText(/Synthetic shared message|Sensitive saved note|Synthetic private snapshot/)).not.toBeInTheDocument();
  });
});

describe("FE-017 authorized note saving", () => {
  it("validates trimmed input and keeps the editor accessible", async () => {
    render(<ProfessionalCaseView id="case-one" />);
    const editor = await screen.findByLabelText("New case note");
    fireEvent.change(editor, { target: { value: " x " } });
    fireEvent.submit(editor.closest("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent("between 2 and 4,000");
    expect(editor).toHaveAttribute("aria-invalid", "true"); expect(mocks.addNote).not.toHaveBeenCalled();
  });
  it("sends one trimmed note and reports success only after acknowledgment", async () => {
    const pending = deferred<{ noteId: string }>(); mocks.addNote.mockReturnValue(pending.promise);
    render(<ProfessionalCaseView id="case-one" />); const editor = await screen.findByLabelText("New case note");
    fireEvent.change(editor, { target: { value: "  Synthetic new note  " } });
    fireEvent.submit(editor.closest("form")!); fireEvent.submit(editor.closest("form")!);
    expect(mocks.addNote).toHaveBeenCalledTimes(1); expect(mocks.addNote).toHaveBeenCalledWith("case-one", "Synthetic new note");
    expect(screen.queryByText(/Note saved/)).not.toBeInTheDocument(); expect(editor).toBeDisabled();
    await act(async () => pending.resolve({ noteId: "note-new" }));
    expect(await screen.findByText("Note saved. The server confirmed receipt.")).toBeInTheDocument();
    expect(screen.getByLabelText("New case note")).toHaveValue(""); expect(mocks.caseDetail).toHaveBeenCalledTimes(2);
  });
  it("retains a rejected draft for correction without exposing server diagnostics", async () => {
    mocks.addNote.mockRejectedValue(new AppError({ code: "VALIDATION_ERROR", statusCode: 400, userMessage: "Private diagnostic" }));
    render(<ProfessionalCaseView id="case-one" />); const editor = await screen.findByLabelText("New case note");
    fireEvent.change(editor, { target: { value: "Synthetic draft" } }); fireEvent.submit(editor.closest("form")!);
    await screen.findByRole("alert"); expect(editor).toHaveValue("Synthetic draft"); expect(screen.getByRole("alert")).not.toHaveTextContent("Private diagnostic");
    expect(screen.queryByText(/Note saved/)).not.toBeInTheDocument();
  });
  it("clears the note and case when saving loses authorization", async () => {
    mocks.addNote.mockRejectedValue(failure(403)); render(<ProfessionalCaseView id="case-one" />);
    const editor = await screen.findByLabelText("New case note"); fireEvent.change(editor, { target: { value: "Sensitive draft" } }); fireEvent.submit(editor.closest("form")!);
    await screen.findByRole("alert"); expect(screen.queryByLabelText("New case note")).not.toBeInTheDocument();
    expect(screen.queryByText("Synthetic shared message")).not.toBeInTheDocument(); expect(mocks.addNote).toHaveBeenCalledTimes(1);
  });
  it("distinguishes a confirmed save from a failed follow-up read and only retries the read", async () => {
    mocks.addNote.mockResolvedValue({ noteId: "confirmed-note" }); mocks.caseDetail.mockResolvedValueOnce(fixture).mockRejectedValueOnce(new TypeError("Read failed")).mockResolvedValue(fixture);
    render(<ProfessionalCaseView id="case-one" />); const editor = await screen.findByLabelText("New case note");
    fireEvent.change(editor, { target: { value: "Synthetic note" } }); fireEvent.submit(editor.closest("form")!);
    await screen.findByRole("alert"); expect(screen.getByText("Note saved. The server confirmed receipt.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" })); await screen.findByLabelText("New case note"); expect(mocks.addNote).toHaveBeenCalledTimes(1);
  });
  it("never replays an uncertain save; requires a read and explicit review before a new note", async () => {
    mocks.addNote.mockRejectedValue(new TypeError("Network failed"));
    render(<ProfessionalCaseView id="case-one" />); const editor = await screen.findByLabelText("New case note");
    fireEvent.change(editor, { target: { value: "Synthetic draft" } }); fireEvent.submit(editor.closest("form")!);
    await screen.findByText(/Note receipt could not be confirmed/);
    expect(screen.queryByLabelText("New case note")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    const fresh = await screen.findByLabelText("New case note"); expect(fresh).toBeDisabled(); expect(fresh).toHaveValue("");
    expect(mocks.addNote).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "I reviewed the notes; enable a new note" })); expect(fresh).toBeEnabled();
  });
  it("clears drafts on access loss and ignores a departed case's save response", async () => {
    const pending = deferred<{ noteId: string }>(); mocks.addNote.mockReturnValue(pending.promise);
    render(<ProfessionalCaseView id="case-one" />); const editor = await screen.findByLabelText("New case note");
    fireEvent.change(editor, { target: { value: "Synthetic draft" } }); fireEvent.submit(editor.closest("form")!);
    mocks.caseDetail.mockRejectedValue(failure(403));
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden"); fireEvent(document, new Event("visibilitychange"));
    visibility.mockReturnValue("visible"); fireEvent(document, new Event("visibilitychange"));
    await screen.findByRole("alert"); await act(async () => pending.resolve({ noteId: "old-note" }));
    expect(screen.queryByText(/Note saved/)).not.toBeInTheDocument(); expect(screen.queryByLabelText("New case note")).not.toBeInTheDocument(); visibility.mockRestore();
  });
  it("warns before refreshing an unsaved note without persisting plaintext", async () => {
    const storage = vi.spyOn(Storage.prototype, "setItem"); const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ProfessionalCaseView id="case-one" />); const editor = await screen.findByLabelText("New case note");
    fireEvent.change(editor, { target: { value: "Sensitive unsaved draft" } }); await userEvent.click(screen.getByRole("button", { name: "Refresh case" }));
    expect(confirm).toHaveBeenCalled(); expect(editor).toHaveValue("Sensitive unsaved draft"); expect(mocks.caseDetail).toHaveBeenCalledTimes(1); expect(storage).not.toHaveBeenCalled();
    storage.mockRestore(); confirm.mockRestore();
  });
  it("keeps terminal cases read-only", async () => {
    mocks.caseDetail.mockResolvedValue({ ...fixture, request: { ...fixture.request, status: "closed" } }); render(<ProfessionalCaseView id="case-one" />);
    await screen.findByText("Synthetic shared message"); expect(screen.queryByLabelText("New case note")).not.toBeInTheDocument();
  });
});

describe("FE-018 closure and transfer", () => {
  it("requires confirmation, restores focus on cancel, and prevents duplicate closure", async () => {
    const pending = deferred<unknown>(); mocks.close.mockReturnValue(pending.promise);
    render(<ProfessionalCaseView id="case-one" />);
    const trigger = await screen.findByRole("button", { name: "Close case" }); await userEvent.click(trigger);
    expect(mocks.close).not.toHaveBeenCalled(); await userEvent.keyboard("{Escape}"); expect(trigger).toHaveFocus();
    await userEvent.click(trigger); const confirm = screen.getByRole("button", { name: "Confirm closure" }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(mocks.close).toHaveBeenCalledTimes(1); expect(mocks.close).toHaveBeenCalledWith("case-one");
    expect(screen.queryByText(/Closure confirmed by the server/)).not.toBeInTheDocument();
    mocks.caseDetail.mockResolvedValue({ ...fixture, request: { ...fixture.request, status: "closed" } });
    await act(async () => pending.resolve({ request: { ...fixture.request, status: "closed" } }));
    expect(await screen.findByText(/Closure confirmed by the server/)).toBeInTheDocument();
    expect(screen.getAllByText("Closed").length).toBeGreaterThan(0); expect(screen.queryByRole("button", { name: "Close case" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("New case note")).not.toBeInTheDocument();
  });
  it.each(["proposed", "confirmed"])("blocks closing with a %s appointment", async (status) => {
    mocks.caseDetail.mockResolvedValue({ ...fixture, appointments: [{ id: "appointment", startsAt: "2026-10-14T08:00:00Z", endsAt: "2026-10-14T09:00:00Z", mode: "online", locationHint: "", status }] });
    render(<ProfessionalCaseView id="case-one" />);
    expect(await screen.findByRole("button", { name: "Close case" })).toBeDisabled(); expect(screen.getByText(/Cancel the active appointment/)).toBeInTheDocument();
    expect(mocks.close).not.toHaveBeenCalled();
  });
  it.each([409, 503])("reloads after HTTP %s without replaying closure or reporting success", async (statusCode) => {
    mocks.close.mockRejectedValue(new AppError({ code: "APPOINTMENT_ACTIVE" as AppError["code"], statusCode, userMessage: "Private diagnostic" }));
    render(<ProfessionalCaseView id="case-one" />); await userEvent.click(await screen.findByRole("button", { name: "Close case" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm closure" })); await screen.findByRole("alert");
    expect(screen.queryByText(/Closure confirmed/)).not.toBeInTheDocument(); expect(screen.queryByText("Synthetic shared message")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).not.toHaveTextContent("Private diagnostic");
    await userEvent.click(screen.getByRole("button", { name: "Retry" })); await screen.findByText("Synthetic shared message"); expect(mocks.close).toHaveBeenCalledTimes(1);
  });
  it("shows unsupported transfer honestly without collecting a closure reason", async () => {
    render(<ProfessionalCaseView id="case-one" />);
    expect(await screen.findByRole("button", { name: "Transfer case unavailable" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Close case" }));
    expect(screen.getByText(/closure reason is not available in this workspace/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /reason/i })).not.toBeInTheDocument();
  });
  it("handles an uncertain closure network result without automatically repeating the mutation", async () => {
    mocks.close.mockRejectedValue(new TypeError("Network interrupted")); render(<ProfessionalCaseView id="case-one" />);
    await userEvent.click(await screen.findByRole("button", { name: "Close case" })); await userEvent.click(screen.getByRole("button", { name: "Confirm closure" }));
    await screen.findByText(/Closure could not be confirmed/); expect(screen.queryByText(/Closure confirmed by the server/)).not.toBeInTheDocument();
    mocks.caseDetail.mockResolvedValue({ ...fixture, request: { ...fixture.request, status: "closed" } });
    await userEvent.click(screen.getByRole("button", { name: "Retry" })); await screen.findByText("Synthetic shared message");
    expect(screen.queryByRole("button", { name: "Close case" })).not.toBeInTheDocument(); expect(mocks.close).toHaveBeenCalledTimes(1);
  });
});

vi.mock("@/services/experience/experience-api", () => ({ experienceApi: { getSupportResources: async () => [] } }));

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfessionalMessagesView } from "./professional-messages-view";
import { ProfessionalSupportHistoryView } from "./professional-support-history-view";

const mocks = vi.hoisted(() => ({
  ownRequests: vi.fn(),
  organizations: vi.fn(),
  messages: vi.fn(),
  sharing: vi.fn(),
  markMessagesRead: vi.fn(),
  sendMessage: vi.fn(),
  ownDetail: vi.fn(),
  timeline: vi.fn(),
}));

vi.mock("@/services/professionals/professional-api", () => ({ professionalApi: mocks }));
vi.mock("@/shared/components/layout/echo-shells", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("../components/professional-support-nav", () => ({
  ProfessionalSupportNav: () => <nav>Support navigation</nav>,
}));

const request = (status: string) => ({
  id: "fe000000-0000-4000-8000-000000000010",
  organizationId: "fe000000-0000-4000-8000-000000000001",
  status,
  assignedTo: "fe000000-0000-4000-8000-000000000002",
  sharingActive: true,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-12T00:00:00.000Z",
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.organizations.mockResolvedValue({
    organizations: [{ id: request("assigned").organizationId, name: "Care Center" }],
  });
  mocks.messages.mockResolvedValue({ messages: [], nextCursor: null });
  mocks.sharing.mockResolvedValue({ records: [] });
  mocks.markMessagesRead.mockResolvedValue({ read: true });
});

describe("user professional support pages", () => {
  it("refreshes an incoming reply and the current case status without a page reload", async () => {
    mocks.ownRequests.mockResolvedValue({ requests: [request("assigned")] });
    render(<ProfessionalMessagesView />);
    await screen.findByRole("textbox", { name: "Message your practitioner" });
    mocks.messages.mockResolvedValue({ messages: [{ id: "reply", requestId: request("assigned").id, sender: "professional", body: "Fictional new reply", createdAt: "2026-10-12T01:00:00Z" }], nextCursor: null });
    mocks.ownRequests.mockResolvedValue({ requests: [request("closed")] });
    await userEvent.click(screen.getByRole("button", { name: "Refresh conversation" }));
    expect(await screen.findByText("Fictional new reply")).toBeInTheDocument();
    expect(await screen.findByText(/This case is read-only/)).toBeInTheDocument();
  });

  it("does not render a message returned for a different case", async () => {
    mocks.ownRequests.mockResolvedValue({ requests: [request("assigned")] });
    mocks.messages.mockResolvedValue({ messages: [{ id: "wrong", requestId: "other-case", sender: "professional", body: "Wrong-case fixture", createdAt: "2026-10-12T01:00:00Z" }], nextCursor: null });
    render(<ProfessionalMessagesView />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("Wrong-case fixture")).not.toBeInTheDocument();
    expect(mocks.markMessagesRead).not.toHaveBeenCalled();
  });

  it("coalesces duplicate form submits while retaining the retry identifier", async () => {
    mocks.ownRequests.mockResolvedValue({ requests: [request("assigned")] });
    let reject!: (reason: Error) => void;
    mocks.sendMessage.mockImplementationOnce(() => new Promise((_, no) => { reject = no; }));
    render(<ProfessionalMessagesView />);
    const draft = await screen.findByRole("textbox", { name: "Message your practitioner" });
    fireEvent.change(draft, { target: { value: "Fictional safe retry" } });
    fireEvent.submit(draft.closest("form")!); fireEvent.submit(draft.closest("form")!);
    expect(mocks.sendMessage).toHaveBeenCalledTimes(1);
    await act(async () => reject(new TypeError("Network unavailable")));
    const first = mocks.sendMessage.mock.calls[0][1];
    mocks.sendMessage.mockResolvedValue({ message: { id: "sent", requestId: request("assigned").id, sender: "user", body: first.body, createdAt: "2026-10-12T01:00:00Z" } });
    fireEvent.submit(draft.closest("form")!);
    await screen.findByText("Fictional safe retry");
    expect(mocks.sendMessage.mock.calls[1][1]).toEqual(first);
  });

  it("sends a message in an assigned case and shows it in the thread", async () => {
    mocks.ownRequests.mockResolvedValue({ requests: [request("assigned")] });
    mocks.sendMessage.mockResolvedValue({
      message: {
        id: "fe000000-0000-4000-8000-000000000011",
        requestId: request("assigned").id,
        sender: "user",
        body: "I can meet tomorrow",
        createdAt: "2026-10-12T01:00:00.000Z",
      },
    });
    render(<ProfessionalMessagesView />);
    await screen.findByRole("textbox", { name: "Message your practitioner" });
    await userEvent
      .setup()
      .type(screen.getByRole("textbox", { name: "Message your practitioner" }), "I can meet tomorrow");
    await userEvent.setup().click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() =>
      expect(mocks.sendMessage).toHaveBeenCalledWith(
        request("assigned").id,
        expect.objectContaining({ body: "I can meet tomorrow" }),
      ),
    );
    expect(await screen.findByText("I can meet tomorrow")).toBeInTheDocument();
  });

  it("keeps closed conversations read-only", async () => {
    mocks.ownRequests.mockResolvedValue({ requests: [request("closed")] });
    render(<ProfessionalMessagesView />);
    expect(await screen.findByText(/This case is read-only/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
  });

  it("keeps messaging available if shared references fail to load", async () => {
    mocks.ownRequests.mockResolvedValue({ requests: [request("assigned")] });
    mocks.sharing.mockRejectedValueOnce(new Error("Storage unavailable"));
    render(<ProfessionalMessagesView />);
    expect(await screen.findByRole("textbox", { name: "Message your practitioner" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/Shared records could not be loaded/);
  });

  it("shows a previous case's appointments, referrals, and timeline", async () => {
    mocks.ownRequests.mockResolvedValue({ requests: [request("closed")] });
    mocks.ownDetail.mockResolvedValue({
      request: { ...request("closed"), summary: "Support with stress" },
      appointments: [{ id: "a1", startsAt: "2026-10-10T01:00:00.000Z", mode: "online", status: "completed" }],
      referrals: [
        { id: "r1", resourceName: "Campus resource", resourceUrl: null, createdAt: "2026-10-11T01:00:00.000Z" },
      ],
    });
    mocks.timeline.mockResolvedValue({
      events: [{ id: "e1", label: "Case closed", createdAt: "2026-10-12T01:00:00.000Z" }],
    });
    render(<ProfessionalSupportHistoryView />);
    expect(await screen.findByText("Support with stress")).toBeInTheDocument();
    expect(screen.getByText("Campus resource")).toBeInTheDocument();
    expect(screen.getByText("Case closed")).toBeInTheDocument();
  });
});

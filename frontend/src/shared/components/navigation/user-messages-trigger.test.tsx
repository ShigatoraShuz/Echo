import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserMessagesTrigger } from "./user-messages-trigger";

const api = vi.hoisted(() => ({
  ownRequests: vi.fn(),
  messages: vi.fn(),
  markMessagesRead: vi.fn(),
  sendMessage: vi.fn(),
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("@/services/professionals/professional-api", () => ({ professionalApi: api }));

const caseId = "fe000000-0000-4000-8000-000000000010";
const request = {
  id: caseId,
  organizationId: "fe000000-0000-4000-8000-000000000001",
  status: "assigned",
  assignedTo: "fe000000-0000-4000-8000-000000000002",
  sharingActive: true,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-12T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  api.ownRequests.mockResolvedValue({ requests: [request] });
  api.messages.mockResolvedValue({
    messages: [
      {
        id: "message-1",
        requestId: caseId,
        sender: "professional",
        body: "Fictional practitioner reply",
        createdAt: "2026-10-12T01:00:00.000Z",
      },
    ],
    nextCursor: null,
  });
  api.markMessagesRead.mockResolvedValue({ read: true });
});

describe("UserMessagesTrigger", () => {
  it("loads conversations only when opened and lets the owner reply in a right-hand drawer", async () => {
    const user = userEvent.setup();
    render(<UserMessagesTrigger />);
    expect(api.ownRequests).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Professional messages" }));
    expect(await screen.findByRole("dialog", { name: "Messages" })).toBeInTheDocument();
    expect(await screen.findByText("Case FE000000")).toBeInTheDocument();
    expect(api.messages).not.toHaveBeenCalled();

    await user.click(screen.getByText("Case FE000000").closest("button")!);
    expect(await screen.findByText("Fictional practitioner reply")).toBeInTheDocument();
    expect(api.markMessagesRead).toHaveBeenCalledWith(caseId);

    api.sendMessage.mockResolvedValue({
      message: {
        id: "message-2",
        requestId: caseId,
        sender: "user",
        body: "Thank you",
        createdAt: "2026-10-12T02:00:00.000Z",
      },
    });
    await user.type(screen.getByRole("textbox", { name: "Message your practitioner" }), "Thank you");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Thank you")).toBeInTheDocument();
    expect(api.sendMessage).toHaveBeenCalledWith(
      caseId,
      expect.objectContaining({ body: "Thank you", clientMessageId: expect.any(String) }),
    );

    await user.click(screen.getByRole("button", { name: "Close panel" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Messages" })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Professional messages" })).toHaveFocus();
  });

  it("rejects a response for a different case and does not acknowledge it", async () => {
    const user = userEvent.setup();
    api.messages.mockResolvedValue({
      messages: [
        {
          id: "wrong",
          requestId: "another-case",
          sender: "professional",
          body: "Wrong-case secret",
          createdAt: "2026-10-12T01:00:00.000Z",
        },
      ],
      nextCursor: null,
    });
    render(<UserMessagesTrigger />);
    await user.click(screen.getByRole("button", { name: "Professional messages" }));
    await user.click((await screen.findByText("Case FE000000")).closest("button")!);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("Wrong-case secret")).not.toBeInTheDocument();
    expect(api.markMessagesRead).not.toHaveBeenCalled();
  });

  it("keeps a closed case readable without a send control", async () => {
    const user = userEvent.setup();
    api.ownRequests.mockResolvedValue({ requests: [{ ...request, status: "closed" }] });
    render(<UserMessagesTrigger />);
    await user.click(screen.getByRole("button", { name: "Professional messages" }));
    await user.click((await screen.findByText("Case FE000000")).closest("button")!);
    expect(await screen.findByText("Fictional practitioner reply")).toBeInTheDocument();
    expect(screen.getByText(/This case is read-only/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
  });

  it("restores focus and usable controls after leaving an in-flight refresh", async () => {
    const user = userEvent.setup();
    let resolveRefresh!: (value: { requests: typeof request[] }) => void;
    api.ownRequests
      .mockResolvedValueOnce({ requests: [request] })
      .mockReturnValueOnce(new Promise((resolve) => { resolveRefresh = resolve; }));
    render(<UserMessagesTrigger />);
    await user.click(screen.getByRole("button", { name: "Professional messages" }));
    const row = (await screen.findByText("Case FE000000")).closest("button")!;
    await user.click(row);
    await waitFor(() => expect(screen.getByRole("button", { name: "Back to conversations" })).toHaveFocus());
    await screen.findByText("Fictional practitioner reply");
    await user.click(screen.getByRole("button", { name: "Refresh conversation" }));
    await user.click(screen.getByRole("button", { name: "Back to conversations" }));
    await waitFor(() => expect(screen.getByText("Case FE000000").closest("button")).toHaveFocus());
    await user.click(screen.getByText("Case FE000000").closest("button")!);
    await screen.findByText("Fictional practitioner reply");
    expect(screen.getByRole("button", { name: "Refresh conversation" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    resolveRefresh({ requests: [request] });
    expect(screen.getByText("Fictional practitioner reply")).toBeInTheDocument();
  });
});

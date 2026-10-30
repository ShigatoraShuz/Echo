import { StrictMode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ProfessionalCaseMessages } from "./professional-case-messages";

const api = vi.hoisted(() => ({ caseMessages: vi.fn(), markCaseMessagesRead: vi.fn() }));
vi.mock("@/services/professionals/professional-api", () => ({ professionalApi: api }));

it("loads and acknowledges one authorized transcript under Strict Mode, then fetches fresh data on reactivation", async () => {
  let finish!: (value: object) => void;
  api.caseMessages.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  api.markCaseMessagesRead.mockResolvedValue({ read: true });
  const failed = vi.fn();
  const view = (active: boolean) => <StrictMode><ProfessionalCaseMessages caseId="synthetic-case" readOnly={false} active={active} onFailure={failed} /></StrictMode>;
  const rendered = render(view(true));
  await waitFor(() => expect(api.caseMessages).toHaveBeenCalledTimes(1));
  await act(async () => finish({ messages: [{ id: "synthetic-message", requestId: "synthetic-case", sender: "user", body: "Fictional authorized transcript", createdAt: "2026-01-01T00:00:00Z" }], nextCursor: null }));
  await screen.findByText("Fictional authorized transcript");
  expect(api.markCaseMessagesRead).toHaveBeenCalledTimes(1); expect(failed).not.toHaveBeenCalled();
  rendered.rerender(view(false));
  api.caseMessages.mockResolvedValue({ messages: [], nextCursor: null });
  rendered.rerender(view(true));
  await screen.findByText("No messages in this case yet.");
  expect(api.caseMessages).toHaveBeenCalledTimes(2);
});

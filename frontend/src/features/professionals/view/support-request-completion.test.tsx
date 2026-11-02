import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { SupportRequestView } from "./support-request-view";
const mocks = vi.hoisted(() => ({
  createRequest: vi.fn(),
  complete: vi.fn(),
  push: vi.fn(),
}));
vi.mock("next/navigation", () => {
  const params = new URLSearchParams();
  return {
    useRouter: () => ({ push: mocks.push }),
    useSearchParams: () => params,
  };
});
vi.mock("@/features/journal/model/support-journey", () => ({
  completeSupportVisit: mocks.complete,
  supportVisitToken: () => "test-visit",
}));
vi.mock("@/services/professionals/professional-api", () => ({
  professionalApi: {
    organizations: async () => ({
      organizations: [
        { id: "test-org", name: "Fictional support organization" },
      ],
    }),
    journalChoices: async () => [],
    createRequest: mocks.createRequest,
  },
}));
vi.mock("@/services/experience/experience-api", () => ({
  experienceApi: {
    getWellnessStatus: async () => ({ assessment: { history: [] } }),
  },
}));
vi.mock("@/shared/components/layout/echo-shells", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));
vi.mock("../components/professional-support-nav", () => ({
  ProfessionalSupportNav: () => null,
}));
vi.mock("../components/professional-support-header", () => ({
  ProfessionalSupportHeader: () => <h1>Support request</h1>,
}));
beforeEach(() => {
  vi.clearAllMocks();
});
it.each([true, false])(
  "marks the visit complete only when the request succeeds (%s)",
  async (success) => {
    mocks.createRequest.mockImplementation(async () => {
      if (!success) throw Error("Fictional server failure");
      return { request: { id: "test-request" } };
    });
    render(<SupportRequestView />);
    const input = await screen.findByLabelText(/What would you like help with/);
    fireEvent.change(input, {
      target: { value: "Fictional support request integration verification." },
    });
    await userEvent
      .setup()
      .click(
        screen.getByRole("checkbox", { name: /I agree to share this request/ }),
      );
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Send support request" }));
    await waitFor(() => expect(mocks.createRequest).toHaveBeenCalledOnce());
    if (success) {
      await waitFor(() =>
        expect(mocks.complete).toHaveBeenCalledExactlyOnceWith(
          "professional",
          "test-visit",
        ),
      );
      expect(mocks.push).toHaveBeenCalledOnce();
    } else {
      await screen.findByRole("alert");
      expect(mocks.complete).not.toHaveBeenCalled();
      expect(mocks.push).not.toHaveBeenCalled();
    }
  },
);

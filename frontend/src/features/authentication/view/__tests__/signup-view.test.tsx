import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignupView } from "../signup-view";
import { registrationApi } from "@/services/authentication/registration-api";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

vi.mock("@/services/authentication/registration-api", () => ({
  registrationApi: { eligibility: vi.fn(), policies: vi.fn(), agreements: vi.fn(), email: vi.fn() },
}));
const policies = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    document_type: "terms_of_use",
    version: "v1",
    title: "Terms of Use",
    summary: "Terms",
    sanitized_markdown: "## Terms\n\nRead terms",
    effective_at: "2026-01-01",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    document_type: "privacy_notice",
    version: "v1",
    title: "Privacy Notice",
    summary: "Privacy",
    sanitized_markdown: "## Privacy\n\nRead privacy",
    effective_at: "2026-01-01",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    document_type: "ai_analysis_notice",
    version: "v1",
    title: "AI Analysis Notice",
    summary: "AI",
    sanitized_markdown: "## AI\n\nRead AI notice",
    effective_at: "2026-01-01",
  },
] as const;

describe("SignupView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(registrationApi.eligibility).mockResolvedValue({ eligible: true });
    vi.mocked(registrationApi.policies).mockResolvedValue([...policies]);
    vi.mocked(registrationApi.agreements).mockResolvedValue({ nextStep: "account" });
    vi.mocked(registrationApi.email).mockResolvedValue({ verificationPending: true });
  });
  it("requires eligibility and document review before creating an email account", async () => {
    const user = userEvent.setup();
    render(<SignupView title="Create account" description="Join ECHO" />);
    fireEvent.change(screen.getByLabelText(/birthday/i), { target: { value: "1990-01-01" } });
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await screen.findByText("Know what you're agreeing to");
    for (const title of ["Terms of Use", "Privacy Notice", "AI Analysis Notice"]) {
      await user.click(screen.getAllByRole("button", { name: "Review" })[0]);
      const scroller = screen.getByRole("dialog").querySelector("[tabindex='-1']")!;
      Object.defineProperties(scroller, {
        scrollTop: { value: 100, writable: true },
        clientHeight: { value: 100 },
        scrollHeight: { value: 200 },
      });
      fireEvent.scroll(scroller);
      await user.click(screen.getByRole("button", { name: /acknowledge and close/i }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(screen.getByText(title)).toBeInTheDocument();
    }
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await screen.findByText("Create your private account");
    await user.type(screen.getByLabelText(/email address/i), "mira@example.com");
    await user.type(screen.getByLabelText(/^password/i), "SecurePass1");
    await user.type(screen.getByLabelText(/confirm password/i), "SecurePass1");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    await screen.findByText("Check your inbox");
    expect(registrationApi.email).toHaveBeenCalledWith({
      email: "mira@example.com",
      password: "SecurePass1",
      confirmPassword: "SecurePass1",
    });
  });
});

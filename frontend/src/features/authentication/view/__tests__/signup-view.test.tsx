import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignupView } from "../signup-view";
import { useSignupViewModel } from "@/features/authentication/view-model/use-signup-view-model";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/features/authentication/view-model/use-signup-view-model", () => ({
  useSignupViewModel: vi.fn(),
}));

function setupMock() {
  return {
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    termsAccepted: false,
    privacyAcknowledged: false,
    dataProcessingAcknowledged: false,
    aiFeatureAcknowledged: false,
    journalAnalysisConsent: false,
    showPassword: false,
    passwordStrength: { score: 0, label: "" },
    status: "idle" as const,
    error: null,
    fieldErrors: {},
    setName: vi.fn(),
    setEmail: vi.fn(),
    setPassword: vi.fn(),
    setConfirmPassword: vi.fn(),
    setTermsAccepted: vi.fn(),
    setPrivacyAcknowledged: vi.fn(),
    setDataProcessingAcknowledged: vi.fn(),
    setAiFeatureAcknowledged: vi.fn(),
    setJournalAnalysisConsent: vi.fn(),
    togglePasswordVisibility: vi.fn(),
    submit: vi.fn().mockResolvedValue({ id: "session-1" }),
    reset: vi.fn(),
  };
}

describe("SignupView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("wires the form controls and consent checkboxes", async () => {
    const user = userEvent.setup();
    const mock = setupMock();
    vi.mocked(useSignupViewModel).mockReturnValue(mock as ReturnType<typeof setupMock>);

    render(<SignupView title="Create account" description="Join ECHO" />);

    await user.click(screen.getAllByRole("button", { name: /show password/i })[0]);
    await user.type(screen.getByLabelText(/display name/i), "Mira");
    await user.type(screen.getByPlaceholderText("you@example.com"), "mira@example.com");
    await user.click(screen.getByLabelText(/i accept the terms of use/i));
    await user.click(screen.getByLabelText(/i have read the privacy notice/i));
    await user.click(screen.getByLabelText(/i understand my account details/i));
    await user.click(screen.getByLabelText(/optional: allow ai analysis/i));
    await user.click(screen.getByRole("button", { name: /create private account/i }));

    expect(mock.setName).toHaveBeenCalled();
    expect(mock.setEmail).toHaveBeenCalled();
    expect(mock.setTermsAccepted).toHaveBeenCalled();
    expect(mock.setPrivacyAcknowledged).toHaveBeenCalled();
    expect(mock.setDataProcessingAcknowledged).toHaveBeenCalled();
    expect(mock.setJournalAnalysisConsent).toHaveBeenCalled();
    expect(mock.submit).toHaveBeenCalled();
  });
});

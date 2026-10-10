import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginView } from "../login-view";
import { useLoginViewModel } from "@/features/authentication/view-model/use-login-view-model";

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  useSearchParams: () => navigation.searchParams,
}));

vi.mock("@/features/authentication/view-model/use-login-view-model", () => ({
  useLoginViewModel: vi.fn(),
}));
vi.mock("@/features/authentication/components/secure-google-login-button", () => ({
  SecureGoogleLoginButton: ({ successPath }: { successPath: string }) => <span data-testid="google-destination">{successPath}</span>,
}));
vi.mock("@/features/authentication/components/email-otp-form", () => ({
  EmailOtpForm: ({ onAuthenticated }: { onAuthenticated: () => void }) => <button type="button" onClick={onAuthenticated}>Finish email sign in</button>,
}));

function setupMock() {
  return {
    email: "",
    password: "",
    rememberSession: false,
    showPassword: false,
    status: "idle" as const,
    error: null,
    fieldErrors: {},
    setEmail: vi.fn(),
    setPassword: vi.fn(),
    setRememberSession: vi.fn(),
    togglePasswordVisibility: vi.fn(),
    submit: vi.fn().mockResolvedValue({ id: "session-1" }),
    reset: vi.fn(),
  };
}

describe("LoginView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigation.searchParams = new URLSearchParams();
  });

  it("wires the main controls and submits the form", async () => {
    const user = userEvent.setup();
    const mock = setupMock();
    vi.mocked(useLoginViewModel).mockReturnValue(mock as ReturnType<typeof setupMock>);

    render(<LoginView title="Log in" description="Welcome back" />);

    await user.click(screen.getByRole("button", { name: /use password instead/i }));
    await user.click(screen.getByRole("button", { name: /show password/i }));
    await user.click(screen.getByLabelText(/remember me on this device/i));
    await user.type(screen.getByLabelText(/email address/i), "mira@example.com");
    await user.type(screen.getByPlaceholderText("Enter your password"), "secret123");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    expect(mock.setEmail).toHaveBeenCalled();
    expect(mock.setPassword).toHaveBeenCalled();
    expect(mock.setRememberSession).toHaveBeenCalled();
    expect(mock.togglePasswordVisibility).toHaveBeenCalled();
    expect(mock.submit).toHaveBeenCalled();
  });

  it("explains why a signed-out user was sent to the login page", () => {
    navigation.searchParams = new URLSearchParams("error=login_required&next=%2Fdashboard");
    vi.mocked(useLoginViewModel).mockReturnValue(setupMock() as ReturnType<typeof setupMock>);

    render(<LoginView title="Log in" description="Welcome back" />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Please log in to continue. This page is only available to signed-in users.",
    );
  });

  it("returns an ordinary user to a safe support request after password sign-in", async () => {
    navigation.searchParams = new URLSearchParams("next=%2Fprofessional%2Frequest");
    vi.mocked(useLoginViewModel).mockReturnValue(setupMock() as ReturnType<typeof setupMock>);
    const user = userEvent.setup();
    render(<LoginView title="Log in" description="Welcome back" />);
    await user.click(screen.getByRole("button", { name: /use password instead/i }));
    await user.click(screen.getByRole("button", { name: /^log in$/i }));
    expect(navigation.replace).toHaveBeenCalledWith("/professional/request");
  });

  it("routes professional password sign-in through the access gateway", async () => {
    vi.mocked(useLoginViewModel).mockReturnValue(setupMock() as ReturnType<typeof setupMock>);
    const user = userEvent.setup();
    render(<LoginView title="Professional sign in" description="Professional workspace" destination="/professional/access" />);
    await user.click(screen.getByRole("button", { name: /use password instead/i }));
    await user.click(screen.getByRole("button", { name: /^log in$/i }));
    expect(navigation.replace).toHaveBeenCalledWith("/professional/access");
  });

  it("uses the professional access destination for email code and Google sign-in", async () => {
    vi.mocked(useLoginViewModel).mockReturnValue(setupMock() as ReturnType<typeof setupMock>);
    render(<LoginView title="Professional sign in" description="Professional workspace" destination="/professional/access?next=%2Fprofessional" />);
    expect(screen.getByTestId("google-destination")).toHaveTextContent("/professional/access?next=%2Fprofessional");
    await userEvent.setup().click(screen.getByRole("button", { name: "Finish email sign in" }));
    expect(navigation.replace).toHaveBeenCalledWith("/professional/access?next=%2Fprofessional");
  });
});

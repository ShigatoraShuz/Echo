import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginView } from "../login-view";
import { useLoginViewModel, type FormStatus } from "@/features/authentication/view-model/use-login-view-model";

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

function setupMock() {
  return {
    email: "",
    password: "",
    rememberSession: false,
    showPassword: false,
    status: "idle" as FormStatus,
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

    expect(screen.queryByRole("button", { name: /send sign-in code/i })).not.toBeInTheDocument();
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

  it("clears stale login success after the access gateway sends the user back", async () => {
    navigation.searchParams = new URLSearchParams("error=access_check_unavailable");
    const mock = { ...setupMock(), status: "success" as const };
    vi.mocked(useLoginViewModel).mockReturnValue(mock as ReturnType<typeof setupMock>);

    render(<LoginView title="Log in" description="Welcome back" />);

    expect(mock.reset).toHaveBeenCalled();
    expect(screen.queryByText("Operation completed successfully.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^log in$/i })).toBeEnabled();
  });

  it("returns an ordinary user to a safe support request after password sign-in", async () => {
    navigation.searchParams = new URLSearchParams("next=%2Fprofessional%2Frequest");
    vi.mocked(useLoginViewModel).mockReturnValue(setupMock() as ReturnType<typeof setupMock>);
    const user = userEvent.setup();
    render(<LoginView title="Log in" description="Welcome back" />);
    await user.click(screen.getByRole("button", { name: /^log in$/i }));
    expect(navigation.replace).toHaveBeenCalledWith("/professional/request");
  });

  it("routes professional password sign-in through the access gateway", async () => {
    vi.mocked(useLoginViewModel).mockReturnValue(setupMock() as ReturnType<typeof setupMock>);
    const user = userEvent.setup();
    render(<LoginView title="Professional sign in" description="Professional workspace" destination="/professional/access" />);
    await user.click(screen.getByRole("button", { name: /^log in$/i }));
    expect(navigation.replace).toHaveBeenCalledWith("/professional/access");
  });

  it("shows only password sign-in and retains the migration link", () => {
    vi.mocked(useLoginViewModel).mockReturnValue(setupMock() as ReturnType<typeof setupMock>);
    render(<LoginView title="Professional sign in" description="Professional workspace" destination="/professional/access?next=%2Fprofessional" />);
    expect(screen.queryByRole("button", { name: /continue with google/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /email code/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter your password")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /google|move your account/i })).not.toBeInTheDocument();
  });
});

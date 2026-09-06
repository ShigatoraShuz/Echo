import { render, screen } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import { AdminLoginView } from "../admin-login-view";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
it("requires email codes for reviewer sign-in too", () => {
  render(<AdminLoginView />);
  expect(screen.getByLabelText("Admin email")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Send sign-in code" })).toBeInTheDocument();
  expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
});

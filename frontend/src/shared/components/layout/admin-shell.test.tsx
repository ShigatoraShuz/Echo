import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminShell } from "./admin-shell";
import { getAuthService } from "@/services/authentication/auth-service.factory";

const replace = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock("@/services/authentication/auth-service.factory", () => ({ getAuthService: vi.fn() }));

describe("AdminShell", () => {
  it("shows admin navigation without user workspace actions and logs out", async () => {
    vi.mocked(getAuthService).mockReturnValue({ logout: vi.fn().mockResolvedValue({ success: true }) } as never);
    render(<AdminShell><h1>Review queue</h1></AdminShell>);
    expect(screen.getByRole("navigation", { name: "Admin navigation" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Verification reviews" })).toHaveAttribute("href", "/admin/verifications");
    expect(screen.queryByRole("link", { name: "Journal" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Write reflection" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin-login"));
    expect(refresh).toHaveBeenCalled();
  });
});

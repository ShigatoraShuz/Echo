import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PolicyUpdatePage from "@/app/(onboarding)/onboarding/policies/page";
import { registrationApi, type PolicyDocument } from "@/services/authentication/registration-api";

const replace = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn() }) }));
vi.mock("@/services/authentication/registration-api", () => ({ registrationApi: { policies: vi.fn() } }));
vi.mock("@/infrastructure/supabase/browser-client", () => ({
  createBrowserSupabaseClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "test-only" } } }),
    },
  }),
}));
const policies: PolicyDocument[] = ["terms_of_use", "privacy_notice", "ai_analysis_notice"].map((kind, index) => ({
  id: `policy-${index}`,
  document_type: kind as PolicyDocument["document_type"],
  title: `Notice ${index}`,
  version: "v2",
  summary: "Review summary",
  sanitized_markdown: "## Your choices\n\nRead carefully.",
  effective_at: "2026-08-31",
}));
beforeEach(() => {
  vi.mocked(registrationApi.policies).mockResolvedValue(policies);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(300);
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(100);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function reviewAll() {
  for (const policy of policies) {
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(policy.title) }));
    const acknowledge = screen.getByRole("button", { name: "Acknowledge and close" });
    await waitFor(() => expect(acknowledge).toBeEnabled());
    fireEvent.click(acknowledge);
  }
}
describe("Policy update page", () => {
  it("requires explicit review of all three and sends exact IDs without an AI preference", async () => {
    const request = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", request);
    render(<PolicyUpdatePage />);
    expect(screen.getByRole("button", { name: "Accept current policies" })).toBeDisabled();
    await reviewAll();
    fireEvent.click(screen.getByRole("button", { name: "Accept current policies" }));
    await waitFor(() => expect(request).toHaveBeenCalledOnce());
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ reviewedDocumentIds: policies.map((p) => p.id) });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/onboarding"));
  });
  it("lets users dismiss a notice without accepting it", async () => {
    render(<PolicyUpdatePage />);
    fireEvent.click(await screen.findByRole("button", { name: /Notice 0/ }));
    fireEvent.click(screen.getByRole("button", { name: "Close for now" }));
    expect(screen.getByRole("button", { name: "Accept current policies" })).toBeDisabled();
  });
  it("shows a recoverable loading failure instead of an empty gate", async () => {
    vi.mocked(registrationApi.policies).mockRejectedValueOnce(new Error("offline"));
    render(<PolicyUpdatePage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be loaded");
    fireEvent.click(screen.getByRole("button", { name: "Reload documents" }));
    expect(await screen.findByRole("button", { name: /Notice 0/ })).toBeVisible();
  });
  it("retains the review screen on a failed or stale acceptance", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400 }));
    render(<PolicyUpdatePage />);
    await reviewAll();
    fireEvent.click(screen.getByRole("button", { name: "Accept current policies" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Reload the documents");
    expect(replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Reload documents" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Accept current policies" })).toBeDisabled());
  });
});

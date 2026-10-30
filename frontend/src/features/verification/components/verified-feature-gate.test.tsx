import { render, screen, fireEvent } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import { VerifiedFeatureGate } from "./verified-feature-gate";
const api = vi.hoisted(() => ({ getStatus: vi.fn() }));
vi.mock("@/services/verification/verification-service.factory", () => ({ getVerificationService: () => api }));
it("can recover from a failed access lookup only after a fresh successful authorization check", async () => {
  api.getStatus.mockResolvedValueOnce({ success: false }).mockResolvedValueOnce({ success: true, data: { canAccessAi: true } });
  render(<VerifiedFeatureGate featureName="Insights"><p>Authorized content</p></VerifiedFeatureGate>);
  fireEvent.click(await screen.findByRole("button", { name: "Retry access check" }));
  expect(await screen.findByText("Authorized content")).toBeInTheDocument();
  expect(api.getStatus).toHaveBeenCalledTimes(2);
});

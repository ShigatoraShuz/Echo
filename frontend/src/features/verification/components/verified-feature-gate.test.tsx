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

it("shows only the public loading shell until a fresh access decision allows private content", async () => {
  let finish!: (value: unknown) => void;
  api.getStatus.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  render(<VerifiedFeatureGate featureName="Insights" loadingFallback={<h1>Your emotional patterns</h1>}><p>Private saved result</p></VerifiedFeatureGate>);
  expect(screen.getByRole("heading", {name: "Your emotional patterns"})).toBeInTheDocument();
  expect(screen.queryByText("Private saved result")).not.toBeInTheDocument();
  finish({success: true, data: {canAccessAi: false}});
  expect(await screen.findByRole("heading", {name: "Insights requires verification"})).toBeInTheDocument();
  expect(screen.queryByText("Private saved result")).not.toBeInTheDocument();
});

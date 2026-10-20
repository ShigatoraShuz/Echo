import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "jest-axe";
import type { SupportResource } from "@/services/experience/experience-api";
import { AppError } from "@/shared/errors/app-error";
import { ProfessionalCrisisSupport, reviewedCrisisResources } from "./professional-crisis-support";

const api = vi.hoisted(() => ({ getSupportResources: vi.fn() }));
vi.mock("@/services/experience/experience-api", () => ({ experienceApi: api }));
const resource: SupportResource = { id: "fixture", type: "crisis_hotline", countryCode: "PH", regionCode: null, name: "Synthetic resource", organizationName: "Fictional organization", description: "Fictional directory entry", phoneNumber: null, smsNumber: null, websiteUrl: "https://example.invalid/service", verificationSource: "https://example.invalid/source", lastVerifiedAt: "2026-01-01T00:00:00Z", availability: "Published fixture hours" };
beforeEach(() => { vi.resetAllMocks(); api.getSupportResources.mockResolvedValue([resource]); });
describe("FE-025 professional crisis resources", () => {
  it("uses only the existing reviewed directory and never sends case information", async () => {
    const { container } = render(<ProfessionalCrisisSupport />); expect(screen.getByRole("status")).toHaveTextContent("Loading reviewed"); await screen.findByText("Synthetic resource");
    expect(api.getSupportResources).toHaveBeenCalledWith({ country: "PH", type: "crisis_hotline" }); expect(screen.getByRole("button", { name: "Escalation unavailable" })).toBeDisabled();
    expect(screen.getByText(/does not continuously monitor/)).toBeInTheDocument(); expect(screen.getByRole("link", { name: "Service website" })).toHaveAttribute("href", resource.websiteUrl); expect(await axe(container)).toHaveNoViolations();
  });
  it("excludes unverifiable, wrong-region, future and malformed source entries", () => {
    expect(reviewedCrisisResources([resource, { ...resource, id: "wrong", countryCode: "US" }, { ...resource, verificationSource: "javascript:alert(1)" }, { ...resource, lastVerifiedAt: "2099-01-01T00:00:00Z" }, { ...resource, lastVerifiedAt: "invalid" }, { ...resource, type: "clinic" }])).toEqual([resource]);
  });
  it("handles an empty reviewed directory without invented fallback contacts", async () => {
    api.getSupportResources.mockResolvedValue([]); render(<ProfessionalCrisisSupport />); await screen.findByText(/No reviewed crisis resources/); expect(screen.queryByRole("link", { name: /^Call / })).not.toBeInTheDocument();
  });
  it.each([401, 403, 429, 503])("handles HTTP %s without raw diagnostics or cached entries", async (statusCode) => {
    api.getSupportResources.mockRejectedValue(new AppError({ code: "UNKNOWN_ERROR", statusCode, userMessage: "Private backend diagnostic" })); render(<ProfessionalCrisisSupport />); await screen.findByRole("alert"); expect(screen.queryByText("Synthetic resource")).not.toBeInTheDocument(); expect(screen.getByRole("alert")).not.toHaveTextContent("Private backend");
  });
  it("recovers a network failure through an explicit read retry", async () => {
    api.getSupportResources.mockRejectedValueOnce(new TypeError("Network failed")).mockResolvedValue([resource]); render(<ProfessionalCrisisSupport />); await userEvent.click(await screen.findByRole("button", { name: "Retry resource directory" })); await screen.findByText("Synthetic resource"); expect(api.getSupportResources).toHaveBeenCalledTimes(2);
  });
  it("ignores a response after the protected case unmounts", async () => {
    let resolve!: (value: SupportResource[]) => void; api.getSupportResources.mockReturnValue(new Promise<SupportResource[]>((done) => { resolve = done; })); const { unmount } = render(<ProfessionalCrisisSupport />); unmount(); await act(async () => resolve([resource])); expect(screen.queryByText("Synthetic resource")).not.toBeInTheDocument();
  });
  it.each(["ready", "loading", "empty", "denied", "network", "server"] as const)("keeps the synthetic %s scenario offline and non-mutating", (state) => {
    render(<ProfessionalCrisisSupport preview={{ state }} />); expect(api.getSupportResources).not.toHaveBeenCalled(); expect(screen.queryByRole("link")).not.toBeInTheDocument(); expect(screen.getByRole("button", { name: "Escalation unavailable" })).toBeDisabled();
  });
});

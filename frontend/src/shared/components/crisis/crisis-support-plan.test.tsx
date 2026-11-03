import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CrisisSupportPlan } from "./crisis-support-plan";

const api = vi.hoisted(() => ({
  getSupportResources: vi.fn(),
}));

vi.mock("@/services/experience/experience-api", () => ({
  experienceApi: api,
}));

const continuation=vi.hoisted(()=>({blockedReflections:vi.fn(),confirmContinuation:vi.fn()}));
vi.mock('@/services/journal/crisis-continuation',()=>continuation);
const resource = {
  id: "ncmh",
  type: "crisis_hotline",
  organizationName: "National Center for Mental Health",
  name: "NCMH Crisis Hotline",
  description: "Free crisis support by phone.",
  phoneNumber: "1553",
  smsNumber: null,
  websiteUrl: "https://example.com/ncmh",
  availability: "Available 24/7",
  countryCode: "PH",
  regionCode: null,
  lastVerifiedAt: "2026-09-01T00:00:00.000Z",
  verificationSource: "https://example.com/source",
};

beforeEach(() => {
  vi.clearAllMocks();
  continuation.blockedReflections.mockResolvedValue([]);
  api.getSupportResources.mockResolvedValue([resource]);
});

describe("CrisisSupportPlan", () => {
  it("keeps emergency calls immediate and supports one-step-at-a-time grounding", async () => {
    render(<CrisisSupportPlan />);

    expect(await screen.findByRole("heading", { name: "NCMH Crisis Hotline" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Call emergency services 911" })).toHaveAttribute("href", "tel:911");
    expect(screen.getByRole("link", { name: "Call NCMH Crisis Hotline 1553" })).toHaveAttribute("href", "tel:1553");
    expect(screen.getByRole("link", { name: "Call emergency services 911" })).toHaveClass("echo-emergency-link");
    expect(screen.getByRole("link", { name: "Return to ECHO" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Find local help" })).toHaveAttribute("href", "/support/find-help");
    expect(screen.queryByRole("link", { name: "More grounding support" })).not.toBeInTheDocument();

    const firstStep = screen.getByRole("button", {
      name: /Call local emergency services now.*Mark when complete/i,
    });
    fireEvent.click(firstStep);

    expect(firstStep).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("1 of 4 marked")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start breathing cue" }));
    expect(screen.getByText("Breathe in gently for 4")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next cue" }));
    expect(screen.getByText("Hold only if comfortable for 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "End cue" }));
    expect(screen.getByRole("button", { name: "Start breathing cue" })).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Call NCMH Crisis Hotline at 1553" })).toHaveAttribute("href", "tel:1553");
    expect(api.getSupportResources).toHaveBeenCalledWith({ type: "crisis_hotline" });
  });

  it("offers a retry when the verified directory cannot load", async () => {
    api.getSupportResources
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce([resource]);

    render(<CrisisSupportPlan />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/directory is unavailable/i);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(api.getSupportResources).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("heading", { name: "NCMH Crisis Hotline" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a quiet loading state before the directory resolves", () => {
    api.getSupportResources.mockReturnValue(new Promise(() => undefined));

    render(<CrisisSupportPlan />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading verified crisis resources");
  });

  it("keeps the emergency numbers available when the verified directory is empty", async () => {
    api.getSupportResources.mockResolvedValue([]);

    render(<CrisisSupportPlan />);

    expect(await screen.findByText(/no additional directory entries/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Call emergency services 911" })).toHaveAttribute("href", "tel:911");
  });

  it("never turns an unreviewable source or website into a link", async () => {
    api.getSupportResources.mockResolvedValue([{
      ...resource,
      verificationSource: "OpenAI Hotline Directory",
      websiteUrl: "javascript:alert(1)",
    }]);

    render(<CrisisSupportPlan />);

    expect(await screen.findByText(/no additional directory entries/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "NCMH Crisis Hotline" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Official source/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Website" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Call NCMH Crisis Hotline 1553" })).toHaveAttribute("href", "tel:1553");
  });
});

it('enables return confirmation after all four steps when no analysis is paused',async()=>{
 render(<CrisisSupportPlan/>);
 const steps=screen.getAllByRole('button').filter(button=>button.textContent?.includes('Mark when complete'));
 expect(steps).toHaveLength(4);for(const step of steps)fireEvent.click(step);
 expect(await screen.findByRole('button',{name:'Confirm and return to journal'})).toBeEnabled();
 expect(screen.queryByText('No saved local reflection is waiting for confirmation.')).not.toBeInTheDocument();
 expect(continuation.confirmContinuation).not.toHaveBeenCalled();
});
it('does not treat failed job lookup as no paused analysis',async()=>{
 continuation.blockedReflections.mockRejectedValue(new Error('Lookup unavailable'));
 render(<CrisisSupportPlan/>);
 for(const step of screen.getAllByRole('button').filter(button=>button.textContent?.includes('Mark when complete')))fireEvent.click(step);
 expect(await screen.findByRole('alert')).toHaveTextContent('Lookup unavailable');
 expect(screen.getByRole('button',{name:'Confirm and continue analysis'})).toBeDisabled();
});

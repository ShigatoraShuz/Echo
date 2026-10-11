import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import FindHelpPage from "./page";

const api = vi.hoisted(() => ({
  getSupportResources: vi.fn(),
}));

vi.mock("@/services/experience/experience-api", () => ({
  experienceApi: api,
}));

vi.mock("@/shared/components/layout/echo-shells", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const resources = [
  {
    id: "ncmh",
    type: "crisis_hotline",
    organizationName: "National Center for Mental Health",
    name: "NCMH Crisis Hotline",
    description: "Confidential emotional support.",
    phoneNumber: "1553",
    smsNumber: null,
    websiteUrl: "https://example.com/ncmh",
    availability: "Available 24/7",
    countryCode: "PH",
    regionCode: null,
    lastVerifiedAt: "2026-09-29T00:00:00.000Z",
    verificationSource: "https://example.com/source",
  },
  {
    id: "cavite",
    type: "clinic",
    organizationName: "Cavite Center for Mental Health",
    name: "Cavite outpatient department",
    description: "Outpatient mental-health support.",
    phoneNumber: "+63 46 419 0013",
    smsNumber: null,
    websiteUrl: "https://example.com/cavite",
    availability: "8 AM - 5 PM",
    countryCode: "PH",
    regionCode: null,
    lastVerifiedAt: "2026-09-13T00:00:00.000Z",
    verificationSource: "https://example.com/cavite/source",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  api.getSupportResources.mockResolvedValue(resources);
});

describe("FindHelpPage", () => {
  it("loads once and filters the reviewed directory locally", async () => {
    const user = userEvent.setup();
    render(<FindHelpPage />);

    expect(await screen.findByRole("heading", { name: "NCMH Crisis Hotline" })).toBeInTheDocument();
    expect(api.getSupportResources).toHaveBeenCalledTimes(1);
    expect(api.getSupportResources).toHaveBeenCalledWith({ country: "PH" });

    await user.type(screen.getByRole("textbox", { name: "Search support resources" }), "Cavite");

    expect(screen.queryByRole("heading", { name: "NCMH Crisis Hotline" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cavite outpatient department" })).toBeInTheDocument();
    expect(api.getSupportResources).toHaveBeenCalledTimes(1);
  });

  it("filters categories and keeps phone and website actions explicit", async () => {
    const user = userEvent.setup();
    render(<FindHelpPage />);
    await screen.findByRole("heading", { name: "NCMH Crisis Hotline" });

    await user.click(screen.getByRole("button", { name: "Clinics" }));

    expect(screen.queryByRole("heading", { name: "NCMH Crisis Hotline" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Call Cavite outpatient department at +63 46 419 0013" })).toHaveAttribute("href", "tel:+63464190013");
    expect(screen.getByRole("link", { name: "Visit Cavite outpatient department website" })).toHaveAttribute("href", "https://example.com/cavite");
  });

  it("uses Directory by default and exposes Guidance as the mobile companion view", async () => {
    const user = userEvent.setup();
    render(<FindHelpPage />);
    await screen.findByRole("heading", { name: "NCMH Crisis Hotline" });

    expect(screen.getByRole("tab", { name: "Directory" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("tab", { name: "Guidance" }));

    expect(screen.getByRole("tab", { name: "Guidance" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Self-help resources" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Grounding tools/i })).toHaveAttribute("href", "/tools/grounding");
  });

  it("keeps error, retry, and empty-result states inside the directory", async () => {
    api.getSupportResources
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce([]);
    render(<FindHelpPage />);

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("The directory could not be loaded.")).toBeInTheDocument();
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(api.getSupportResources).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("No reviewed matches found.")).toBeInTheDocument();
  });
});

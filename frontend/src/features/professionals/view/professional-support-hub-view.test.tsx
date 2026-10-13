import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfessionalSupportHubView } from "./professional-support-hub-view";

const mocks = vi.hoisted(() => ({ hub: vi.fn() }));

vi.mock("@/services/professionals/professional-api", () => ({ professionalApi: { hub: mocks.hub } }));
vi.mock("@/shared/components/layout/echo-shells", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/shared/components/ui/echo-motion-surface", () => ({
  EchoMotionSurface: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}));
vi.mock("../components/professional-support-nav", () => ({
  ProfessionalSupportNav: () => <nav>Support navigation</nav>,
}));

const organization = {
  id: "fe000000-0000-4000-8000-000000000001",
  slug: "care",
  name: "Care Center",
  description: "",
  serviceHours: "",
  location: "",
  serviceTypes: [],
  consultationMethods: [],
  status: "active",
};
const request = (id: string, organizationId: string) => ({
  id,
  organizationId,
  preferredProfileId: null,
  status: "assigned",
  assignedTo: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  preferredTime: "",
  sharingActive: true,
  sharedJournalCount: 0,
  sharedPhq8Count: 0,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hub.mockResolvedValue({
    activeCases: [
      request("fe000000-0000-4000-8000-000000000010", organization.id),
      request("fe000000-0000-4000-8000-000000000011", "fe000000-0000-4000-8000-000000000002"),
    ],
    recentCases: [],
    recentMessages: [],
    upcomingAppointment: null,
    unreadCount: 0,
    organizations: [
      organization,
      { ...organization, id: "fe000000-0000-4000-8000-000000000002", name: "Second Center" },
    ],
    discoveryPreview: [],
  });
});

describe("ProfessionalSupportHubView", () => {
  it("loads the hub once and lets users switch active cases", async () => {
    render(<ProfessionalSupportHubView />);
    expect(await screen.findByText("Care Center", { selector: "strong" })).toBeInTheDocument();
    await waitFor(() => expect(mocks.hub).toHaveBeenCalledTimes(1));
    await userEvent.setup().selectOptions(screen.getByLabelText("Active case"), "fe000000-0000-4000-8000-000000000011");
    expect(await screen.findByText("Second Center", { selector: "strong" })).toBeInTheDocument();
  });

  it("offers working destinations when no support case exists", async () => {
    mocks.hub.mockResolvedValueOnce({
      activeCases: [],
      recentCases: [],
      recentMessages: [],
      upcomingAppointment: null,
      unreadCount: 0,
      organizations: [],
      discoveryPreview: [],
    });
    render(<ProfessionalSupportHubView />);
    expect(await screen.findByText(/No active support case/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Find a professional/i })[0]).toHaveAttribute(
      "href",
      "/professional-support/discover",
    );
    expect(screen.getByRole("link", { name: /Open crisis support/i })).toHaveAttribute("href", "/crisis");
  });
});

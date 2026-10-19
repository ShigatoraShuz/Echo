import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfessionalAppointmentsView } from "./professional-appointments-view";
import { ProfessionalDirectoryView } from "./professional-directory-view";

const mocks = vi.hoisted(() => ({
  appointments: vi.fn(), respondAppointment: vi.fn(), requestAppointmentChange: vi.fn(),
  cancelAppointment: vi.fn(), organizations: vi.fn(), directory: vi.fn(),
}));
vi.mock("@/services/professionals/professional-api", () => ({ professionalApi: mocks }));
vi.mock("@/shared/components/layout/echo-shells", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("@/shared/components/ui/echo-motion-surface", () => ({ EchoMotionSurface: ({ children }: { children: React.ReactNode }) => <article>{children}</article> }));
vi.mock("../components/professional-support-nav", () => ({ ProfessionalSupportNav: () => <nav>Support navigation</nav> }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.organizations.mockResolvedValue({ organizations: [] });
  mocks.directory.mockResolvedValue({ practitioners: [], nextCursor: null });
  mocks.respondAppointment.mockResolvedValue({ appointmentId: "a1", status: "confirmed" });
  mocks.requestAppointmentChange.mockResolvedValue({ changeRequestId: "c1" });
  mocks.cancelAppointment.mockResolvedValue({ appointmentId: "a1", status: "cancelled" });
});

describe("user professional support actions", () => {
  it("searches the live directory and shows practitioner credentials", async () => {
    mocks.directory.mockResolvedValue({ practitioners: [{
      id: "p1", organizationId: "o1", organizationName: "Care Center", displayName: "Alex Rivera",
      role: "counselor", credentialLabel: "Licensed counselor", bio: "Support for stress",
      specialties: ["Stress"], serviceTypes: [], consultationMethods: ["online"],
      location: "", responseHours: "Weekdays", acceptingRequests: true,
    }], nextCursor: null });
    render(<ProfessionalDirectoryView />);
    expect(await screen.findByText("Alex Rivera")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByText("View credentials & services"));
    expect(screen.getByText("Stress")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Request support/i })).toHaveAttribute("href", "/professional-support/requests/new?practitioner=p1&organization=o1");
    await userEvent.setup().type(screen.getByPlaceholderText("Search name, credential, or specialty"), "Alex");
    await waitFor(() => expect(mocks.directory).toHaveBeenCalledWith(expect.objectContaining({ query: "Alex" }), expect.anything()));
  });

  it("accepts an appointment and requests a new time through the backend", async () => {
    mocks.appointments.mockResolvedValue({ appointments: [{ id: "a1", startsAt: "2099-10-15T10:00:00.000Z", endsAt: "2099-10-15T11:00:00.000Z", status: "proposed", mode: "online", locationHint: "" }] });
    vi.spyOn(window, "prompt").mockReturnValue("Friday afternoon");
    render(<ProfessionalAppointmentsView />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "Accept" }));
    await waitFor(() => expect(mocks.respondAppointment).toHaveBeenCalledWith("a1", true));
    await userEvent.setup().click(screen.getByRole("button", { name: "Request change" }));
    await waitFor(() => expect(mocks.requestAppointmentChange).toHaveBeenCalledWith("a1", "Friday afternoon"));
    vi.mocked(window.prompt).mockRestore();
  });

  it("lets a user retry an unavailable appointment list", async () => {
    mocks.appointments
      .mockRejectedValueOnce(new Error("Service unavailable"))
      .mockResolvedValueOnce({ appointments: [{ id: "a1", startsAt: "2099-10-15T10:00:00.000Z", endsAt: "2099-10-15T11:00:00.000Z", status: "proposed", mode: "online", locationHint: "" }] });
    render(<ProfessionalAppointmentsView />);
    const reload = await screen.findByRole("button", { name: "Reload appointments" });
    await userEvent.setup().click(reload);
    expect(await screen.findByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(mocks.appointments).toHaveBeenCalledTimes(2);
  });
});

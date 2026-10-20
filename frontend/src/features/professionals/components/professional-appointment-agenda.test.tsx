import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "jest-axe";
import { agendaGroups } from "../professional-appointments.model";
import { ProfessionalAppointmentAgenda } from "./professional-appointment-agenda";

const now = Date.parse("2026-10-13T10:00:00Z");
const item = { id: "a", startsAt: "2026-10-14T10:00:00Z", endsAt: "2026-10-14T11:00:00Z", mode: "online", locationHint: "Synthetic meeting", status: "proposed" };
const props = { appointments: [item], caseId: "case-one", organizationId: "org-one", viewer: "professional" as const, now };
describe("FE-020 case agenda", () => {
  it("orders by instant, groups dates, includes in-progress sessions, and keeps canceled records separate", () => {
    const appointments = [item, { ...item, id: "earlier", startsAt: "2026-10-13T17:00:00+08:00", endsAt: "2026-10-13T19:00:00+08:00" }, { ...item, id: "past", startsAt: "2026-10-12T10:00:00Z", endsAt: "2026-10-12T11:00:00Z" }, { ...item, id: "canceled", status: "canceled" }];
    const original = structuredClone(appointments);
    expect(agendaGroups(appointments, "upcoming", now).flatMap((group) => group.items.map((row) => row.id))).toEqual(["earlier", "a"]);
    expect(agendaGroups(appointments, "past", now)[0].items[0].id).toBe("past"); expect(agendaGroups(appointments, "canceled", now)[0].items[0].id).toBe("canceled"); expect(appointments).toEqual(original);
  });
  it("supports period controls, scoped case links, safe times and inaccessible rescheduling", async () => {
    const { container } = render(<ProfessionalAppointmentAgenda {...props} />);
    expect(screen.getByText("Synthetic meeting")).toBeInTheDocument(); expect(screen.getByRole("link", { name: "Case CASE-ONE" })).toHaveAttribute("href", "/professional/cases/case-one?organization=org-one");
    expect(screen.getByRole("button", { name: "Rescheduling unavailable" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Past" })); expect(screen.getByRole("status")).toHaveTextContent("No past appointments");
    expect(await axe(container)).toHaveNoViolations();
  });
  it.each(["loading", "error", "denied"] as const)("never renders appointment details during %s", (state) => {
    render(<ProfessionalAppointmentAgenda {...props} state={state} />);
    expect(screen.queryByText("Synthetic meeting")).not.toBeInTheDocument(); expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  it("does not place invalid dates in a group or expose unsupported fields", () => {
    render(<ProfessionalAppointmentAgenda {...props} appointments={[{ ...item, startsAt: "invalid", summary: "Private journal content" } as typeof item]} />);
    expect(screen.getByText(/Some appointment times are unavailable/)).toBeInTheDocument(); expect(screen.queryByText(/Private journal/)).not.toBeInTheDocument();
  });
  it("does not offer practitioner actions or links to an owner viewer", () => {
    const cancel = vi.fn(); render(<ProfessionalAppointmentAgenda {...props} viewer="user" canCancel onCancel={cancel} />);
    expect(screen.queryByRole("button", { name: "Cancel appointment" })).not.toBeInTheDocument(); expect(screen.queryByRole("link")).not.toBeInTheDocument(); expect(cancel).not.toHaveBeenCalled();
  });
});

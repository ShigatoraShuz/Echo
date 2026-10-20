import { describe, expect, it } from "vitest";
import { appointmentProposal, appointmentTime, localAppointmentTime, validateAppointment, type AppointmentDraft } from "./professional-appointments.model";

const draft: AppointmentDraft = { start: "2099-10-20T10:00", end: "2099-10-20T11:00", mode: "online", locationHint: "  Fictional room  " };
describe("FE-019 appointment validation", () => {
  it.each(["", "invalid", "2099-02-30T10:00", "2099-10-20T25:00"])("rejects invalid local time %s", (start) => {
    expect(localAppointmentTime(start)).toBeNull(); expect(validateAppointment({ ...draft, start }, [])).toContain("valid start and end");
  });
  it("rejects past, reversed and over-two-hour ranges", () => {
    expect(validateAppointment(draft, [], new Date("2100-01-01").getTime())).toContain("future");
    expect(validateAppointment({ ...draft, end: draft.start }, [])).toContain("after");
    expect(validateAppointment({ ...draft, end: "2099-10-20T09:00" }, [])).toContain("after");
    expect(validateAppointment({ ...draft, end: "2099-10-20T12:01" }, [])).toContain("two hours");
    expect(validateAppointment({ ...draft, end: "2099-10-20T12:00" }, [])).toBe("");
  });
  it.each(["in_person", "online", "phone"])("accepts supported %s mode and converts local time to UTC", (mode) => {
    expect(validateAppointment({ ...draft, mode }, [])).toBe("");
    expect(appointmentProposal({ ...draft, mode })).toEqual({ startsAt: new Date(draft.start).toISOString(), endsAt: new Date(draft.end).toISOString(), mode, locationHint: "Fictional room" });
  });
  it("rejects unsupported session modes and long meeting details", () => {
    expect(validateAppointment({ ...draft, mode: "video" }, [])).toContain("session type");
    expect(validateAppointment({ ...draft, mode: "toString" }, [])).toContain("session type");
    expect(validateAppointment({ ...draft, locationHint: "x".repeat(241) }, [])).toContain("240");
  });
  it("blocks local overlaps and any active offer while allowing canceled history", () => {
    const appointment = { id: "a", ...appointmentProposal(draft), status: "proposed" };
    expect(validateAppointment(draft, [appointment])).toContain("overlaps");
    expect(validateAppointment({ ...draft, start: "2099-10-21T10:00", end: "2099-10-21T11:00" }, [appointment])).toContain("current proposed");
    expect(validateAppointment(draft, [{ ...appointment, status: "canceled" }])).toBe("");
  });
  it("formats valid times with an offset and safely handles invalid API dates", () => {
    expect(appointmentTime("invalid")).toBe("Time unavailable"); expect(appointmentTime("2099-10-20T10:00:00Z")).toMatch(/GMT/);
  });
});

import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { encryptedFixture, ids, professionalDatabase, seedProfessionalDatabase, serviceRole } from "../../../../tests/fixtures/professional-database.js";
let db: PGlite;
beforeAll(async () => { db = await professionalDatabase(["20261014110000_professional_claim_lifecycle.sql", "20261016100000_professional_appointment_lifecycle.sql"]); }, 30_000);
beforeEach(async () => { await seedProfessionalDatabase(db); await db.query("select professional_service.claim_request($1,$2)", [ids.request, ids.actor]); });
afterAll(async () => db?.close());
interface Appointment { id: string; request_id: string; status: string; starts_at: Date; ends_at: Date; replaces_appointment_id: string | null }
const propose = async (requestId = ids.request, actor = ids.actor) => (await db.query<Appointment>("select * from professional_service.propose_appointment($1,$2,now()+interval '1 day',now()+interval '1 day 1 hour','online',$3)", [requestId, actor, encryptedFixture])).rows[0];
const respond = async (id: string, accept = true, actor = ids.owner) => (await db.query<Appointment>("select * from professional_service.respond_appointment($1,$2,$3)", [id, actor, accept])).rows[0];
const cancel = async (id: string, actor = ids.owner) => (await db.query<Appointment>("select * from professional_service.cancel_appointment($1,$2)", [id, actor])).rows[0];
const reschedule = async (id: string, actor = ids.actor, start = "2099-01-02T10:00:00Z", end = "2099-01-02T11:00:00Z") => (await db.query<Appointment>("select * from professional_service.reschedule_appointment($1,$2,$3,$4,'online',$5)", [id, actor, start, end, encryptedFixture])).rows[0];
const state = async () => (await db.query<{ status: string }>("select status from professional_service.support_requests where id=$1", [ids.request])).rows[0].status;

describe("BE-020 appointment lifecycle", () => {
  it("preserves owner confirmation and retry-safe confirmation/cancellation audits", async () => {
    const offer = await propose(); const confirmed = await respond(offer.id); expect(confirmed.status).toBe("confirmed"); expect(await state()).toBe("scheduled");
    expect(await respond(offer.id)).toEqual(confirmed);
    const canceled = await cancel(offer.id, ids.actor); expect(await cancel(offer.id, ids.actor)).toEqual(canceled); expect(await state()).toBe("assigned");
    for (const action of ["appointment.confirmed", "appointment.canceled"]) expect((await db.query("select id from professional_service.audit_events where action=$1", [action])).rows).toHaveLength(1);
  });
  it("replays owner rejection without extra audit and cannot confirm a canceled offer", async () => {
    const offer = await propose(); const rejected = await respond(offer.id, false); expect(await respond(offer.id, false)).toEqual(rejected);
    await expect(respond(offer.id)).rejects.toThrow("APPOINTMENT_UNAVAILABLE"); expect(await state()).toBe("assigned");
  });
  it("rejects expired proposals but still allows cancellation", async () => {
    const offer = await propose(); await db.exec("reset role");
    await db.query("update professional_service.appointments set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour' where id=$1", [offer.id]); await serviceRole(db);
    await expect(respond(offer.id)).rejects.toThrow("APPOINTMENT_EXPIRED"); expect((await cancel(offer.id)).status).toBe("canceled");
  });
  it.each([ids.second, ids.outsider])("denies unrelated practitioner %s", async (actor) => {
    const offer = await propose(); await expect(respond(offer.id, true, actor)).rejects.toThrow("REQUEST_NOT_FOUND");
    await expect(cancel(offer.id, actor)).rejects.toThrow("REQUEST_NOT_FOUND"); await expect(reschedule(offer.id, actor)).rejects.toThrow("REQUEST_NOT_FOUND");
  });
  it("does not let the owner propose or reschedule, or the practitioner accept for the owner", async () => {
    await expect(propose(ids.request, ids.owner)).rejects.toThrow("ASSIGNMENT_REQUIRED"); const offer = await propose();
    await expect(respond(offer.id, true, ids.actor)).rejects.toThrow("REQUEST_NOT_FOUND"); await expect(reschedule(offer.id, ids.owner)).rejects.toThrow("REQUEST_NOT_FOUND");
  });
  it("checks current eligibility on response and permits owner cancellation after suspension", async () => {
    const offer = await propose(); await db.exec("reset role"); await db.query("update professional_service.memberships set status='suspended' where user_id=$1", [ids.actor]); await serviceRole(db);
    await expect(respond(offer.id)).rejects.toThrow("APPOINTMENT_UNAVAILABLE"); await expect(cancel(offer.id, ids.actor)).rejects.toThrow("REQUEST_NOT_FOUND");
    expect((await cancel(offer.id)).status).toBe("canceled");
  });
  it.each([[null, "2099-01-01T11:00Z"], ["infinity", "infinity"], ["2000-01-01T10:00Z", "2000-01-01T11:00Z"], ["2099-01-01T10:00Z", "2099-01-01T10:00Z"], ["2099-01-01T10:00Z", "2099-01-01T12:01Z"]])("rejects invalid time window %s to %s", async (start, end) => {
    await expect(db.query("select professional_service.propose_appointment($1,$2,$3,$4,'online',$5)", [ids.request, ids.actor, start, end, encryptedFixture])).rejects.toThrow("INVALID_APPOINTMENT");
  });
  it("reschedules atomically to a new proposal requiring fresh owner acceptance, with retry safety", async () => {
    const old = await propose(); await respond(old.id); const next = await reschedule(old.id);
    expect(next).toMatchObject({ status: "proposed", replaces_appointment_id: old.id }); expect(next.id).not.toBe(old.id); expect(await state()).toBe("assigned");
    expect(await reschedule(old.id)).toEqual(next); expect((await respond(next.id)).status).toBe("confirmed");
    expect((await db.query("select id from professional_service.audit_events where action='appointment.rescheduled'")).rows).toHaveLength(1);
    await expect(reschedule(old.id, ids.actor, "2099-01-03T10:00Z", "2099-01-03T11:00Z")).rejects.toThrow("APPOINTMENT_CONFLICT");
  });
  it("rolls back the old cancellation when replacement validation fails", async () => {
    const old = await propose(); await respond(old.id);
    await expect(reschedule(old.id, ids.actor, "2000-01-01T10:00Z", "2000-01-01T11:00Z")).rejects.toThrow("INVALID_APPOINTMENT");
    expect(await state()).toBe("scheduled"); expect((await db.query("select status from professional_service.appointments where id=$1", [old.id])).rows[0]).toEqual({ status: "confirmed" });
    expect((await db.query("select id from professional_service.audit_events where action='appointment.canceled'")).rows).toEqual([]);
  });
  it("rolls back replacement and cancellation together if the final audit fails", async () => {
    const old = await propose(); await db.exec("reset role; alter table professional_service.audit_events add constraint synthetic_reschedule_fail check(action<>'appointment.rescheduled')");
    try { await serviceRole(db); await expect(reschedule(old.id)).rejects.toThrow("synthetic_reschedule_fail"); expect((await db.query("select id,status from professional_service.appointments")).rows).toEqual([{ id: old.id, status: "proposed" }]); }
    finally { await db.exec("reset role; alter table professional_service.audit_events drop constraint synthetic_reschedule_fail"); }
  });
  it.each(["anon", "authenticated"])("denies direct %s invocation with forged role claims", async (role) => {
    const offer = await propose(); await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.role','service_role',false)`);
    await expect(reschedule(offer.id)).rejects.toThrow(/permission denied/);
  });
});

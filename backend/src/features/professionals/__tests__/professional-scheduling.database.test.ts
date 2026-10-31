import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { encryptedFixture, ids, professionalDatabase, seedProfessionalDatabase, serviceRole } from "../../../../tests/fixtures/professional-database.js";
let db: PGlite;
beforeAll(async () => { db = await professionalDatabase(["20261014110000_professional_claim_lifecycle.sql", "20261016100000_professional_appointment_lifecycle.sql", "20261016110000_professional_scheduling_constraints.sql"]); }, 30_000);
beforeEach(async () => { await seedProfessionalDatabase(db); await db.query("select professional_service.claim_request($1,$2)", [ids.request, ids.actor]); });
afterAll(async () => db?.close());
const createCase = async (actor = ids.actor) => {
  const r = (await db.query<{ id: string }>("select * from professional_service.create_request($1,$2,$3,$3,'professional-request-v1','[]')", [ids.org, ids.owner, encryptedFixture])).rows[0];
  await db.query("select professional_service.claim_request($1,$2)", [r.id, actor]); return r.id;
};
const propose = (requestId: string, start = "2099-01-01T10:00:00Z", end = "2099-01-01T11:00:00Z", actor = ids.actor) => db.query<{ id: string }>("select * from professional_service.propose_appointment($1,$2,$3,$4,'online',$5)", [requestId, actor, start, end, encryptedFixture]);

describe("BE-021 PostgreSQL scheduling constraints (single connection)", () => {
  it("rejects overlapping own cases and allows adjacent slots", async () => {
    await propose(ids.request); const next = await createCase();
    await expect(propose(next, "2099-01-01T10:30Z", "2099-01-01T11:30Z")).rejects.toThrow("APPOINTMENT_CONFLICT");
    await expect(propose(next, "2099-01-01T11:00Z", "2099-01-01T12:00Z")).resolves.toBeDefined();
  });
  it("compares absolute instants across UTC offsets", async () => {
    await propose(ids.request); const next = await createCase();
    await expect(propose(next, "2099-01-01T18:00+08:00", "2099-01-01T19:00+08:00")).rejects.toThrow("APPOINTMENT_CONFLICT");
  });
  it("allows different practitioners in the same slot", async () => {
    await propose(ids.request); const other = await createCase(ids.second);
    await expect(propose(other, undefined, undefined, ids.second)).resolves.toBeDefined();
  });
  it("enforces overlap at the database constraint even for trusted direct inserts", async () => {
    await propose(ids.request); const next = await createCase(); await db.exec("reset role");
    await expect(db.query("insert into professional_service.appointments(request_id,professional_user_id,starts_at,ends_at,mode,location_hint_encrypted) values($1,$2,'2099-01-01T10:30Z','2099-01-01T11:30Z','online',$3)", [next, ids.actor, encryptedFixture])).rejects.toMatchObject({ code: "23P01" });
  });
  it("covers the same practitioner across organizations, not just one request queue", async () => {
    await propose(ids.request); await db.exec("reset role");
    const r = (await db.query<{ id: string }>("insert into professional_service.support_requests(organization_id,user_id,summary_encrypted,preferred_time_encrypted,consent_version) values($1,$2,$3,$3,'professional-request-v1') returning id", [ids.otherOrg, ids.owner, encryptedFixture])).rows[0];
    await expect(db.query("insert into professional_service.appointments(request_id,professional_user_id,starts_at,ends_at,mode,location_hint_encrypted) values($1,$2,'2099-01-01T10:30Z','2099-01-01T11:30Z','online',$3)", [r.id, ids.actor, encryptedFixture])).rejects.toMatchObject({ code: "23P01" });
  });
  it("releases a canceled slot while retaining appointment history", async () => {
    const first = (await propose(ids.request)).rows[0]; await db.query("select professional_service.cancel_appointment($1,$2)", [first.id, ids.owner]);
    await expect(propose(await createCase())).resolves.toBeDefined();
    expect((await db.query("select status from professional_service.appointments where id=$1", [first.id])).rows[0]).toEqual({ status: "canceled" });
  });
  it("prevents multiple active appointments in one case even in non-overlapping slots", async () => {
    await propose(ids.request); await expect(propose(ids.request, "2099-01-02T10:00Z", "2099-01-02T11:00Z")).rejects.toThrow("APPOINTMENT_CONFLICT");
  });
  it("rolls back rescheduling if another case already holds the replacement slot", async () => {
    const old = (await propose(ids.request)).rows[0]; const other = await createCase();
    await propose(other, "2099-01-02T10:00Z", "2099-01-02T11:00Z");
    await expect(db.query("select professional_service.reschedule_appointment($1,$2,'2099-01-02T10:30Z','2099-01-02T11:30Z','online',$3)", [old.id, ids.actor, encryptedFixture])).rejects.toThrow("APPOINTMENT_CONFLICT");
    expect((await db.query("select status from professional_service.appointments where id=$1", [old.id])).rows[0]).toEqual({ status: "proposed" });
  });
  it("prevents a canceled conflicting row from being reactivated through direct SQL", async () => {
    const first = (await propose(ids.request)).rows[0]; await db.query("select professional_service.cancel_appointment($1,$2)", [first.id, ids.owner]); await propose(await createCase());
    await db.exec("reset role"); await expect(db.query("update professional_service.appointments set status='proposed' where id=$1", [first.id])).rejects.toMatchObject({ code: "23P01" }); await serviceRole(db);
  });
});

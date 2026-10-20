import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { encryptedFixture, ids, professionalDatabase, seedProfessionalDatabase, serviceRole } from "../../../../tests/fixtures/professional-database.js";
let db: PGlite;
beforeAll(async () => { db = await professionalDatabase(["20261014110000_professional_claim_lifecycle.sql", "20261014120000_professional_dashboard.sql"]); }, 30_000);
beforeEach(async () => seedProfessionalDatabase(db));
afterAll(async () => db?.close());
interface Summary { counts: { pendingCount: number; activeCount: number; scheduledCount: number }; appointments: unknown[]; appointmentTotal: number; clinicalAccess: boolean; scheduledCases: unknown[] }
const overview = async (actor = ids.actor, org = ids.org) => (await db.query<{ result: Summary }>("select professional_service.dashboard_overview($1,$2) as result", [org, actor])).rows[0].result;
describe("BE-013 database aggregation and isolation", () => {
  it("counts beyond 100 and excludes other tenants, without returning client content", async () => {
    await db.exec("reset role");
    await db.query(`insert into professional_service.support_requests(organization_id,user_id,summary_encrypted,preferred_time_encrypted,consent_version)
      select $1,$2,$3,$3,'professional-request-v1' from generate_series(1,200)`, [ids.org, ids.owner, encryptedFixture]);
    await db.query(`insert into professional_service.support_requests(organization_id,user_id,summary_encrypted,preferred_time_encrypted,consent_version) values($1,$2,$3,$3,'professional-request-v1')`, [ids.otherOrg, ids.owner, encryptedFixture]);
    await serviceRole(db);
    const result = await overview(); expect(result.counts).toEqual({ pendingCount: 201, activeCount: 0, scheduledCount: 0 });
    expect(JSON.stringify(result)).not.toMatch(/ciphertext|summary|preferred|journal|credential/);
    expect((await overview(ids.outsider, ids.otherOrg)).counts.pendingCount).toBe(1);
  });
  it("bounds scheduled cases and appointments while returning exact authorized totals", async () => {
    for (let i = 0; i < 6; i++) {
      const row = (await db.query<{ id: string }>("select * from professional_service.create_request($1,$2,$3,$3,'professional-request-v1','[]'::jsonb)", [ids.org, ids.owner, encryptedFixture])).rows[0];
      await db.query("select * from professional_service.claim_request($1,$2)", [row.id, ids.actor]);
      const offer = (await db.query<{ id: string }>(`select * from professional_service.propose_appointment($1,$2,now()+($3::int*interval '1 day'),now()+($3::int*interval '1 day')+interval '1 hour','online',$4)`, [row.id, ids.actor, i + 1, encryptedFixture])).rows[0];
      if (i < 4) await db.query("select * from professional_service.respond_appointment($1,$2,true)", [offer.id, ids.owner]);
    }
    const result = await overview(); expect(result.counts).toEqual({ pendingCount: 1, activeCount: 6, scheduledCount: 4 });
    expect(result.scheduledCases).toHaveLength(3); expect(result.appointments).toHaveLength(5); expect(result.appointmentTotal).toBe(6);
    expect((await overview(ids.second)).counts.activeCount).toBe(0); expect((await overview(ids.second)).appointments).toEqual([]);
    await db.exec(`reset role; update professional_service.memberships set role='coordinator' where user_id='${ids.actor}'`); await serviceRole(db);
    const coordinator = await overview(); expect(coordinator.clinicalAccess).toBe(false); expect(coordinator.appointments).toEqual([]); expect(coordinator.counts.activeCount).toBe(0);
  });
  it.each(["org_admin", "coordinator"])("never returns clinical appointments to %s even when a case was previously assigned", async (role) => {
    await db.query("select professional_service.claim_request($1,$2)", [ids.request, ids.actor]);
    await db.query("select professional_service.propose_appointment($1,$2,now()+interval '1 day',now()+interval '1 day 1 hour','online',$3)", [ids.request, ids.actor, encryptedFixture]);
    expect((await overview()).appointments).toHaveLength(1);
    await db.exec("reset role");
    await db.query("update professional_service.memberships set role=$1 where organization_id=$2 and user_id=$3", [role, ids.org, ids.actor]);
    await serviceRole(db);
    const result = await overview();
    expect(result.clinicalAccess).toBe(false);
    expect(result.appointments).toEqual([]);
    expect(result.appointmentTotal).toBe(0);
    expect(result.scheduledCases).toEqual([]);
    expect(JSON.stringify(result)).not.toMatch(/startsAt|endsAt|requestId/);
  });
  it.each(["suspended", "other tenant", "unapproved account"])("denies %s before returning aggregates", async (kind) => {
    if (kind === "suspended") await db.query("select professional_service.suspend_member(id,$1) from professional_service.memberships where user_id=$2", [ids.admin, ids.actor]);
    if (kind === "unapproved account") { await db.exec(`reset role; update user_service.profiles set eligible_18_plus=false where user_id='${ids.actor}'`); await serviceRole(db); }
    await expect(overview(ids.actor, kind === "other tenant" ? ids.otherOrg : ids.org)).rejects.toThrow("MEMBERSHIP_REQUIRED");
    expect((await db.query("select id from professional_service.audit_events where action='dashboard.viewed'")).rows).toEqual([]);
  });
  it("fails closed if its privacy-safe audit cannot be recorded", async () => {
    await db.exec("reset role; alter table professional_service.audit_events add constraint synthetic_dashboard_audit_fail check(action<>'dashboard.viewed')");
    try { await serviceRole(db); await expect(overview()).rejects.toThrow("synthetic_dashboard_audit_fail"); }
    finally { await db.exec("reset role; alter table professional_service.audit_events drop constraint synthetic_dashboard_audit_fail"); }
  });
  it.each(["anon", "authenticated"])("denies %s direct RPC access even with forged actor claims", async (role) => {
    await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.role','service_role',false)`);
    await expect(overview()).rejects.toThrow(/permission denied/);
  });
});

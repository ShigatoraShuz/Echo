import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { encryptedFixture, ids, professionalDatabase, seedProfessionalDatabase, serviceRole } from "../../../../tests/fixtures/professional-database.js";
let db: PGlite;
beforeAll(async () => { db = await professionalDatabase(["20261014110000_professional_claim_lifecycle.sql"]); }, 30_000);
beforeEach(async () => seedProfessionalDatabase(db));
afterAll(async () => db?.close());
const claim = (actor = ids.actor) => db.query("select * from professional_service.claim_request($1,$2)", [ids.request, actor]);
const close = (actor = ids.actor, status: string | null = "closed") => db.query("select * from professional_service.set_request_status($1,$2,$3)", [ids.request, actor, status]);

describe("BE-010 atomic claim and retry invariants", () => {
  it("permits one assignee and one audit for competing enqueued claims", async () => {
    // PGlite serializes these submissions on one connection. This exercises
    // competing outcomes, not independent Postgres connection lock contention.
    const results = await Promise.allSettled([claim(), claim(ids.second)]);
    expect(results.map((result) => result.status)).toEqual(["fulfilled", "rejected"]);
    expect((results[1] as PromiseRejectedResult).reason.message).toBe("REQUEST_ALREADY_ASSIGNED");
    expect((await claim()).rows[0]).toMatchObject({ assigned_to: ids.actor, status: "assigned" });
    expect((await db.query("select actor_user_id from professional_service.audit_events where action='request.claimed'")).rows).toEqual([{ actor_user_id: ids.actor }]);
  });
  it("does not let a retry authorize a suspended or cross-organization practitioner", async () => {
    await claim(); await expect(claim(ids.outsider)).rejects.toThrow("MEMBERSHIP_REQUIRED");
    await db.query("select professional_service.suspend_member(id,$1) from professional_service.memberships where user_id=$2", [ids.admin, ids.actor]);
    await expect(claim()).rejects.toThrow("MEMBERSHIP_REQUIRED");
  });
  it("rejects a suspended account even while its clinical membership is active", async () => {
    await db.exec(`reset role; update user_service.profiles set account_status='suspended' where user_id='${ids.actor}'`); await serviceRole(db);
    await expect(claim()).rejects.toThrow("MEMBERSHIP_REQUIRED");
  });
  it("rolls back assignment on an audit failure, allowing a safe retry", async () => {
    await db.exec("reset role; alter table professional_service.audit_events add constraint synthetic_claim_fail check(action<>'request.claimed')");
    try {
      await serviceRole(db); await expect(claim()).rejects.toThrow("synthetic_claim_fail");
      expect((await db.query("select status,assigned_to from professional_service.support_requests where id=$1", [ids.request])).rows[0]).toEqual({ status: "submitted", assigned_to: null });
    } finally { await db.exec("reset role; alter table professional_service.audit_events drop constraint synthetic_claim_fail"); }
    await serviceRole(db); expect((await claim()).rows[0]).toMatchObject({ status: "assigned" });
  });
  it("preserves the row lock and browser-role execution restrictions", async () => {
    const definition = (await db.query<{ body: string }>("select pg_get_functiondef('professional_service.claim_request(uuid,uuid)'::regprocedure) as body")).rows[0].body;
    expect(definition).toContain("for update");
    await db.exec("reset role; set role authenticated; select set_config('request.jwt.claim.role','service_role',false)");
    await expect(claim()).rejects.toThrow(/permission denied/);
  });
});

describe("BE-011 request lifecycle", () => {
  it("keeps owner withdrawal compatible and terminal", async () => {
    await db.query("select * from professional_service.withdraw_own_request($1,$2)", [ids.request, ids.owner]);
    await expect(claim()).rejects.toThrow("REQUEST_ALREADY_ASSIGNED");
    await db.exec("reset role");
    await expect(db.query("update professional_service.support_requests set status='submitted' where id=$1", [ids.request])).rejects.toThrow("INVALID_CASE_TRANSITION");
  });
  it("supports assignment, appointment acceptance/cancellation, and repeat-safe closure", async () => {
    await claim();
    const offer = (await db.query<{ id: string }>(`select * from professional_service.propose_appointment($1,$2,now()+interval '1 day',now()+interval '1 day 1 hour','online',$3)`, [ids.request, ids.actor, encryptedFixture])).rows[0];
    await expect(close()).rejects.toThrow("APPOINTMENT_ACTIVE");
    await db.query("select * from professional_service.respond_appointment($1,$2,true)", [offer.id, ids.owner]);
    expect((await claim()).rows[0]).toMatchObject({ status: "scheduled" });
    await db.query("select * from professional_service.cancel_appointment($1,$2)", [offer.id, ids.owner]);
    const first = (await close()).rows[0]; expect((await close()).rows[0]).toEqual(first);
    expect((await db.query("select id from professional_service.audit_events where action='request.closed'")).rows).toHaveLength(1);
    await expect(close(ids.actor, "declined")).rejects.toThrow("INVALID_CASE_TRANSITION");
    await expect(claim()).rejects.toThrow("REQUEST_ALREADY_ASSIGNED");
  });
  it.each([null, "follow_up", "active", "submitted", "transferred"])("denies unsupported transition %s", async (state) => {
    await claim(); await expect(close(ids.actor, state)).rejects.toThrow("INVALID_STATUS");
  });
  it("denies closure and authored writes by an unrelated approved clinician", async () => {
    await claim(); await expect(close(ids.second)).rejects.toThrow("ASSIGNMENT_REQUIRED");
    await expect(db.query("insert into professional_service.case_notes(request_id,author_user_id,body_encrypted) values($1,$2,$3)", [ids.request, ids.second, encryptedFixture])).rejects.toThrow("ASSIGNMENT_REQUIRED");
  });
  it("prevents implicit transfer, owner/tenant changes and scheduling without confirmation", async () => {
    await claim(); await db.exec("reset role");
    for (const [column, value] of [["assigned_to", ids.second], ["organization_id", ids.otherOrg], ["user_id", ids.admin], ["status", "scheduled"]]) {
      await expect(db.query(`update professional_service.support_requests set ${column}=$1 where id=$2`, [value, ids.request])).rejects.toThrow("INVALID_CASE_TRANSITION");
    }
  });
  it("rejects post-closure note/referral writes and keeps prior notes", async () => {
    await claim();
    await db.query("insert into professional_service.case_notes(request_id,author_user_id,body_encrypted) values($1,$2,$3)", [ids.request, ids.actor, encryptedFixture]);
    await close();
    await expect(db.query("insert into professional_service.case_notes(request_id,author_user_id,body_encrypted) values($1,$2,$3)", [ids.request, ids.actor, encryptedFixture])).rejects.toThrow("ASSIGNMENT_REQUIRED");
    await expect(db.query("insert into professional_service.referrals(request_id,author_user_id,resource_name) values($1,$2,'Synthetic resource')", [ids.request, ids.actor])).rejects.toThrow("ASSIGNMENT_REQUIRED");
    expect((await db.query("select id from professional_service.case_notes")).rows).toHaveLength(1);
    const definition = (await db.query<{ body: string }>("select pg_get_functiondef('professional_service.require_assigned_author()'::regprocedure) as body")).rows[0].body;
    expect(definition).toContain("for update");
  });
});

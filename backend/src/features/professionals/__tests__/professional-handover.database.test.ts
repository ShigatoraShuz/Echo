import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { encryptedFixture, ids, professionalDatabase, seedProfessionalDatabase, serviceRole } from "../../../../tests/fixtures/professional-database.js";
let db: PGlite;
beforeAll(async () => { db = await professionalDatabase(["20261014110000_professional_claim_lifecycle.sql", "20261015100000_professional_case_snapshot.sql", "20261015110000_professional_consent.sql", "20261015120000_professional_notes.sql", "20261015130000_professional_case_handover.sql", "20261019090000_professional_withdrawal_compatibility.sql"]); }, 30_000);
beforeEach(async () => { await seedProfessionalDatabase(db); await db.query("select professional_service.claim_request($1,$2)", [ids.request, ids.actor]); });
afterAll(async () => db?.close());
interface Result { request: { id: string; assigned_to: string; status: string }; transferId?: string; reasonEncrypted: string | null }
const transfer = async (target = ids.second, actor = ids.actor) => (await db.query<{ result: Result }>("select professional_service.transfer_case($1,$2,$3,$4,$5) result", [ids.request, actor, target, encryptedFixture, ids.owner])).rows[0].result;
const close = async (reason: string | null = encryptedFixture, actor = ids.actor) => (await db.query<{ result: Result }>("select professional_service.close_case($1,$2,$3) result", [ids.request, actor, reason])).rows[0].result;

describe("same-organization transfer and closure", () => {
  it("atomically transfers to an eligible colleague, revokes old assignment access and replays without duplication", async () => {
    const first = await transfer(); expect(first.request.assigned_to).toBe(ids.second); expect(await transfer()).toEqual(first);
    await expect(db.query("select professional_service.case_snapshot($1,$2)", [ids.request, ids.actor])).rejects.toThrow("REQUEST_NOT_FOUND");
    await expect(db.query("select professional_service.case_snapshot($1,$2)", [ids.request, ids.second])).resolves.toBeDefined();
    expect((await db.query("select id from professional_service.audit_events where action='request.transferred'")).rows).toHaveLength(1);
  });
  it.each([ids.outsider, ids.owner])("rejects an unavailable or cross-organization recipient %s", async (target) => {
    await expect(transfer(target)).rejects.toThrow("TRANSFER_TARGET_UNAVAILABLE");
    expect((await db.query<{ assigned_to: string }>("select assigned_to from professional_service.support_requests where id=$1", [ids.request])).rows[0].assigned_to).toBe(ids.actor);
  });
  it("rejects self transfer, non-assignee action and suspended targets", async () => {
    await expect(transfer(ids.actor)).rejects.toThrow("INVALID_TRANSFER");
    await expect(transfer(ids.actor, ids.second)).rejects.toThrow("ASSIGNMENT_REQUIRED");
    await db.exec("reset role"); await db.query("update professional_service.memberships set status='suspended' where user_id=$1", [ids.second]); await serviceRole(db);
    await expect(transfer()).rejects.toThrow("TRANSFER_TARGET_UNAVAILABLE");
  });
  it("blocks transfer with active appointments or unfinalized author drafts", async () => {
    const offer = (await db.query<{ id: string }>("select * from professional_service.propose_appointment($1,$2,now()+interval '1 day',now()+interval '1 day 1 hour','online',$3)", [ids.request, ids.actor, encryptedFixture])).rows[0];
    await expect(transfer()).rejects.toThrow("APPOINTMENT_ACTIVE"); await expect(close()).rejects.toThrow("APPOINTMENT_ACTIVE");
    await db.query("select professional_service.cancel_appointment($1,$2)", [offer.id, ids.owner]);
    const draft = (await db.query<{ id: string }>("select * from professional_service.save_case_note($1,$2,$3,$4,'draft')", [ids.request, ids.actor, encryptedFixture, ids.owner])).rows[0];
    await expect(transfer()).rejects.toThrow("DRAFT_NOTES_PENDING");
    await db.query("select professional_service.edit_case_note($1,$2,$3,$4,1,true)", [ids.request, draft.id, ids.actor, encryptedFixture]);
    await expect(transfer()).resolves.toBeDefined();
  });
  it("does not permit implicit reassignment or reuse a committed transfer receipt in another transaction", async () => {
    await db.exec("reset role");
    await expect(db.query("update professional_service.support_requests set assigned_to=$1 where id=$2", [ids.second, ids.request])).rejects.toThrow("INVALID_CASE_TRANSITION");
    await serviceRole(db); await transfer();
    await db.exec("reset role");
    await expect(db.query("update professional_service.support_requests set assigned_to=$1 where id=$2", [ids.actor, ids.request])).rejects.toThrow("INVALID_CASE_TRANSITION");
  });
  it("records an encrypted closure reason once and keeps the closed state immutable", async () => {
    const first = await close(); expect(first.request.status).toBe("closed"); expect(await close()).toEqual(first);
    await expect(transfer()).rejects.toThrow("INVALID_CASE_TRANSITION");
    expect((await db.query("select id from professional_service.audit_events where action='request.closed'")).rows).toHaveLength(1);
    await db.exec("reset role");
    const stored = (await db.query<{ reason_encrypted: string }>("select reason_encrypted from professional_service.case_closures")).rows[0]; expect(stored.reason_encrypted).toBe(encryptedFixture);
    await expect(db.query("update professional_service.support_requests set status='assigned' where id=$1", [ids.request])).rejects.toThrow("INVALID_CASE_TRANSITION");
  });
  it("preserves legacy reasonless closure and never backfills a fabricated reason", async () => {
    await db.query("select professional_service.set_request_status($1,$2,'closed')", [ids.request, ids.actor]);
    expect((await close(null)).reasonEncrypted).toBeNull(); await expect(close()).rejects.toThrow("CLOSURE_CONFLICT");
  });
  it.each(["request.transferred", "request.closed"])("rolls back %s and its receipt if auditing fails", async (action) => {
    await db.exec(`reset role; alter table professional_service.audit_events add constraint synthetic_handover_fail check(action<>'${action}')`);
    try {
      await serviceRole(db); await expect(action === "request.transferred" ? transfer() : close()).rejects.toThrow("synthetic_handover_fail");
      expect((await db.query("select status,assigned_to from professional_service.support_requests where id=$1", [ids.request])).rows[0]).toEqual({ status: "assigned", assigned_to: ids.actor });
      await db.exec("reset role"); expect((await db.query("select request_id from professional_service.case_transfers union all select request_id from professional_service.case_closures")).rows).toEqual([]);
    } finally { await db.exec("reset role; alter table professional_service.audit_events drop constraint synthetic_handover_fail"); }
  });
  it.each(["anon", "authenticated"])("denies %s direct workflow/receipt access", async (role) => {
    await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.role','service_role',false)`);
    await expect(transfer()).rejects.toThrow(/permission denied/); await expect(close()).rejects.toThrow(/permission denied/);
    await expect(db.query("select * from professional_service.case_transfers")).rejects.toThrow(/permission denied/);
  });
});

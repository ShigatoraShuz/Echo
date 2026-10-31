import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { encryptedFixture, ids, professionalDatabase, seedProfessionalDatabase, serviceRole } from "../../../../tests/fixtures/professional-database.js";

let db: PGlite;
beforeAll(async () => { db = await professionalDatabase(); }, 30_000);
beforeEach(async () => seedProfessionalDatabase(db));
afterAll(async () => db?.close());
const update = (actor = ids.owner) => db.query("select * from professional_service.update_own_request($1,$2,$3,$4)", [ids.request, actor, encryptedFixture + "-updated", encryptedFixture]);
const withdraw = (actor = ids.owner) => db.query("select * from professional_service.withdraw_own_request($1,$2)", [ids.request, actor]);

describe("BE-009 owner request mutations in isolated PostgreSQL", () => {
  it("updates only owned unassigned request text, preserving organization, sharing scope and consent", async () => {
    const row = (await update()).rows[0];
    expect(row).toMatchObject({ summary_encrypted: encryptedFixture + "-updated", organization_id: ids.org, user_id: ids.owner, status: "submitted", assigned_to: null, consent_version: "professional-request-v1", shared_journal_ids: [] });
    const audit = (await db.query("select action,actor_user_id from professional_service.audit_events where request_id=$1", [ids.request])).rows;
    expect(audit).toEqual([{ action: "request.updated", actor_user_id: ids.owner }]);
    expect(JSON.stringify(audit)).not.toContain("ciphertext");
  });
  it("withdraws once, revokes sharing, and cannot subsequently be claimed", async () => {
    const first = (await withdraw()).rows[0]; const repeated = (await withdraw()).rows[0];
    expect(first).toMatchObject({ status: "closed", assigned_to: null, sharing_revoked_at: expect.any(Date) });
    expect(repeated).toEqual(first);
    expect((await db.query("select id from professional_service.audit_events where action='request.withdrawn'")).rows).toHaveLength(1);
    await expect(db.query("select * from professional_service.claim_request($1,$2)", [ids.request, ids.actor])).rejects.toThrow("REQUEST_ALREADY_ASSIGNED");
  });
  it("allows withdrawal after organization suspension without granting clinical access", async () => {
    await db.exec(`reset role; update professional_service.organizations set status='suspended' where id='${ids.org}'`); await serviceRole(db);
    await expect(update()).rejects.toThrow("REQUEST_NOT_EDITABLE");
    expect((await withdraw()).rows[0]).toMatchObject({ status: "closed" });
  });
  it.each([ids.actor, ids.outsider])("conceals another owner's request from %s", async (actor) => {
    await expect(update(actor)).rejects.toThrow("REQUEST_NOT_FOUND");
    await expect(withdraw(actor)).rejects.toThrow("REQUEST_NOT_FOUND");
  });
  it("prevents updates or withdrawal once a practitioner has won the claim", async () => {
    await db.query("select * from professional_service.claim_request($1,$2)", [ids.request, ids.actor]);
    await expect(update()).rejects.toThrow("REQUEST_NOT_EDITABLE");
    await expect(withdraw()).rejects.toThrow("REQUEST_NOT_EDITABLE");
  });
  it.each(["revoked", "expired"])("does not silently renew %s sharing during an update", async (kind) => {
    await db.exec(kind === "revoked" ? "reset role; update professional_service.support_requests set sharing_revoked_at=now()" : "reset role; update professional_service.support_requests set sharing_expires_at=now()-interval '1 second'"); await serviceRole(db);
    await expect(update()).rejects.toThrow("SHARING_UNAVAILABLE");
    expect((await withdraw()).rows[0]).toMatchObject({ status: "closed" });
  });
  it.each(["anon", "authenticated"])("denies %s even with a forged service-role claim", async (role) => {
    await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.role','service_role',false)`);
    await expect(update()).rejects.toThrow(/permission denied/); await expect(withdraw()).rejects.toThrow(/permission denied/);
  });
  it("requires a service role claim and ciphertext", async () => {
    await db.exec("select set_config('request.jwt.claim.role','',false)"); await expect(withdraw()).rejects.toThrow("SERVICE_ROLE_REQUIRED");
    await serviceRole(db);
    await expect(db.query("select professional_service.update_own_request($1,$2,'plaintext',$3)", [ids.request, ids.owner, encryptedFixture])).rejects.toThrow("REQUEST_INVALID");
  });
  it("rolls back updates and withdrawal if auditing fails", async () => {
    await db.exec("reset role; alter table professional_service.audit_events add constraint synthetic_owner_audit_fail check(action not in ('request.updated','request.withdrawn'))");
    try {
      await serviceRole(db); await expect(update()).rejects.toThrow("synthetic_owner_audit_fail"); await expect(withdraw()).rejects.toThrow("synthetic_owner_audit_fail");
      expect((await db.query("select status,summary_encrypted,sharing_revoked_at from professional_service.support_requests where id=$1", [ids.request])).rows[0]).toEqual({ status: "submitted", summary_encrypted: encryptedFixture, sharing_revoked_at: null });
    } finally { await db.exec("reset role; alter table professional_service.audit_events drop constraint synthetic_owner_audit_fail"); }
  });
});

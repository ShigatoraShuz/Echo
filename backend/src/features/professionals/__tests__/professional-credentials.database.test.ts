import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const USER = "fd000000-0000-4000-8000-000000000001";
const ADMIN = "fd000000-0000-4000-8000-000000000002";
const OTHER = "fd000000-0000-4000-8000-000000000003";
const ORG = "fd000000-0000-4000-8000-000000000004";
const OTHER_ORG = "fd000000-0000-4000-8000-000000000005";
let db: PGlite;
let legacyStatus: unknown;
const fixtures = `
  insert into professional_service.organizations(id,slug,name,status,verified_at,verified_by)
    values ('${ORG}','synthetic-a','Synthetic A','active',now(),'${ADMIN}'),
           ('${OTHER_ORG}','synthetic-b','Synthetic B','active',now(),'${ADMIN}');
`;
async function asService() {
  await db.exec("set role service_role; select set_config('request.jwt.claim.role','service_role',false)");
}
async function submit(actor = USER, org = ORG) {
  return (await db.query<{ id: string; status: string }>(`select * from professional_service.submit_credential(
    $1,$2,'counselor','Synthetic credential',current_date+1,'echo:encrypted:v1:synthetic-reference')`, [org, actor])).rows[0];
}
async function review(id: string, actor = ADMIN, org = ORG, decision = "approved", reason: string | null = null) {
  return db.query("select * from professional_service.review_credential($1,$2,$3,$4,$5)", [org, id, actor, decision, reason]);
}
async function activate(id: string, overrides: { user?: string; org?: string; role?: string; admin?: string; label?: string } = {}) {
  return db.query(`insert into professional_service.memberships(organization_id,user_id,role,status,display_name,
    credential_label,credential_expires_at,approved_at,approved_by,approved_credential_id)
    values($1,$2,$3,'active','Synthetic Practitioner',$4,current_date+1,now(),$5,$6) returning id`, [
    overrides.org ?? ORG, overrides.user ?? USER, overrides.role ?? "counselor",
    overrides.label ?? "Synthetic credential", overrides.admin ?? ADMIN, id,
  ]);
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.role() returns text language sql stable as $$select current_setting('request.jwt.claim.role',true)$$;
    create schema user_service;
    create table user_service.profiles(user_id uuid primary key,account_status text,eligible_18_plus boolean,onboarding_completed boolean);
    create schema verification_service;
    create table verification_service.verification_admins(user_id uuid primary key,is_active boolean);
    insert into auth.users values ('${USER}'),('${ADMIN}'),('${OTHER}');
    insert into user_service.profiles values ('${USER}','active',true,true),('${ADMIN}','active',true,true),('${OTHER}','active',true,true);
    insert into verification_service.verification_admins values ('${ADMIN}',true);
  `);
  await db.exec(await readFile(new URL("../../../../../supabase/migrations/20261010090000_professional_support_portal.sql", import.meta.url), "utf8"));
  await db.exec(fixtures);
  await db.exec(`insert into professional_service.memberships(organization_id,user_id,role,status,display_name,
    credential_label,credential_expires_at,approved_at,approved_by)
    values('${ORG}','${USER}','counselor','active','Legacy Practitioner','Legacy credential',current_date+1,now(),'${ADMIN}')`);
  await db.exec(await readFile(new URL("../../../../../supabase/migrations/20261012160000_professional_credential_reviews.sql", import.meta.url), "utf8"));
  legacyStatus = (await db.query("select status,approved_credential_id from professional_service.memberships")).rows[0];
}, 30_000);
beforeEach(async () => {
  await db.exec(`reset role; truncate professional_service.organizations cascade;
    delete from verification_service.verification_admins where user_id <> '${ADMIN}';
    update verification_service.verification_admins set is_active=true;
    update user_service.profiles set account_status='active'; ${fixtures}`);
});
afterAll(async () => { await db?.close(); });

describe("credential verification database boundary", () => {
  it.each(["suspended", "expired", "other organization"])("denies clinical writes after reviewed membership becomes %s", async (kind) => {
    await asService(); const credential = await submit(); await review(credential.id); await activate(credential.id);
    const support = (await db.query<{ id: string }>(`select * from professional_service.create_request(
      $1,$2,'echo:encrypted:v1:synthetic','echo:encrypted:v1:synthetic','professional-request-v1','[]'::jsonb)`, [ORG, OTHER])).rows[0];
    await db.query("select * from professional_service.claim_request($1,$2)", [support.id, USER]);
    if (kind === "suspended") await db.query("select professional_service.suspend_member(id,$1) from professional_service.memberships", [ADMIN]);
    if (kind === "expired") {
      // Simulate a later date in a transaction under the test database owner.
      await db.exec("reset role; alter table professional_service.memberships disable trigger professional_membership_credential; update professional_service.memberships set credential_expires_at=current_date-1; alter table professional_service.memberships enable trigger professional_membership_credential");
      await asService();
    }
    if (kind === "other organization") {
      await db.exec(`reset role; insert into verification_service.verification_admins values ('${OTHER}',true) on conflict(user_id) do update set is_active=true`);
      await asService();
      const otherCredential = await submit(ADMIN, OTHER_ORG);
      await review(otherCredential.id, OTHER, OTHER_ORG);
      await activate(otherCredential.id, { user: ADMIN, org: OTHER_ORG, admin: OTHER });
    }
    const actor = kind === "other organization" ? ADMIN : USER;
    await expect(db.query("insert into professional_service.case_notes(request_id,author_user_id,body_encrypted) values($1,$2,'echo:encrypted:v1:synthetic')", [support.id, actor])).rejects.toThrow("ASSIGNMENT_REQUIRED");
    await expect(db.query("insert into professional_service.referrals(request_id,author_user_id,resource_name) values($1,$2,'Synthetic referral')", [support.id, actor])).rejects.toThrow("ASSIGNMENT_REQUIRED");
    await expect(db.query("select * from professional_service.set_request_status($1,$2,'closed')", [support.id, actor])).rejects.toThrow();
    expect((await db.query("select id from professional_service.case_notes")).rows).toEqual([]);
    expect((await db.query("select id from professional_service.audit_events where action in ('note.created','referral.created','request.closed')")).rows).toEqual([]);
  });
  it("requires legacy clinical memberships to be re-reviewed without manufacturing evidence", () => {
    expect(legacyStatus).toEqual({ status: "pending", approved_credential_id: null });
  });

  it("records immutable evidence, independent review and membership approval with private audit metadata", async () => {
    await asService();
    const credential = await submit();
    expect(credential.status).toBe("pending");
    await expect(activate(credential.id)).rejects.toThrow("CREDENTIAL_APPROVAL_REQUIRED");
    expect((await db.query("select * from professional_service.read_credential_for_review($1,$2,$3)", [ORG, credential.id, ADMIN])).rows[0])
      .toMatchObject({ evidence_reference_encrypted: "echo:encrypted:v1:synthetic-reference" });
    expect((await review(credential.id)).rows[0]).toMatchObject({ status: "approved", reviewed_by: ADMIN, reviewed_at: expect.any(Date) });
    await activate(credential.id);
    const support = (await db.query<{ id: string }>(`select * from professional_service.create_request(
      $1,$2,'echo:encrypted:v1:synthetic','echo:encrypted:v1:synthetic','professional-request-v1','[]'::jsonb)`, [ORG, OTHER])).rows[0];
    await db.query("select * from professional_service.claim_request($1,$2)", [support.id, USER]);
    await db.query("insert into professional_service.case_notes(request_id,author_user_id,body_encrypted) values($1,$2,'echo:encrypted:v1:synthetic')", [support.id, USER]);
    expect((await db.query("select * from professional_service.set_request_status($1,$2,'closed')", [support.id, USER])).rows[0]).toMatchObject({ status: "closed" });
    await expect(db.exec("update professional_service.credential_reviews set evidence_reference_encrypted='echo:encrypted:v1:changed'")).rejects.toThrow(/permission denied/);
    await expect(review(credential.id)).rejects.toThrow("CREDENTIAL_ALREADY_REVIEWED");
    const audit = (await db.query("select action,credential_review_id from professional_service.audit_events where credential_review_id=$1", [credential.id])).rows;
    expect(audit).toEqual(expect.arrayContaining([
      { action: "credential.submitted", credential_review_id: credential.id },
      { action: "credential.evidence_viewed", credential_review_id: credential.id },
      { action: "credential.approved", credential_review_id: credential.id },
    ]));
    expect(JSON.stringify(audit)).not.toContain("synthetic-reference");
  });

  it("retains rejection metadata, denies activation and accepts a separate corrected submission", async () => {
    await asService();
    const credential = await submit();
    expect((await review(credential.id, ADMIN, ORG, "rejected", "invalid_evidence")).rows[0])
      .toMatchObject({ status: "rejected", reason_code: "invalid_evidence", reviewed_by: ADMIN });
    await expect(activate(credential.id)).rejects.toThrow("CREDENTIAL_APPROVAL_REQUIRED");
    await expect(review(credential.id)).rejects.toThrow("CREDENTIAL_ALREADY_REVIEWED");
    expect((await submit()).id).not.toBe(credential.id);
  });

  it("denies even an active application administrator self-review and self-provisioning", async () => {
    await asService();
    const credential = await submit(ADMIN);
    await expect(review(credential.id)).rejects.toThrow("CREDENTIAL_SELF_REVIEW");
    await expect(review(credential.id, ADMIN, ORG, "rejected", "invalid_evidence")).rejects.toThrow("CREDENTIAL_SELF_REVIEW");
    await expect(activate(credential.id, { user: ADMIN })).rejects.toThrow("CREDENTIAL_FORBIDDEN");
  });

  it.each(["ordinary user", "inactive admin"])("denies evidence reads and decisions by %s", async (kind) => {
    await asService();
    const credential = await submit();
    if (kind === "inactive admin") {
      await db.exec("reset role; update verification_service.verification_admins set is_active=false");
      await asService();
    }
    const actor = kind === "ordinary user" ? OTHER : ADMIN;
    await expect(review(credential.id, actor)).rejects.toThrow("CREDENTIAL_FORBIDDEN");
    await expect(db.query("select * from professional_service.read_credential_for_review($1,$2,$3)", [ORG, credential.id, actor])).rejects.toThrow("CREDENTIAL_FORBIDDEN");
  });

  it("requires matching organization, subject, role, label and approver when activating membership", async () => {
    await asService();
    const credential = await submit();
    await expect(review(credential.id, ADMIN, OTHER_ORG)).rejects.toThrow("CREDENTIAL_UNAVAILABLE");
    await expect(db.query("select * from professional_service.read_credential_for_review($1,$2,$3)", [OTHER_ORG, credential.id, ADMIN])).rejects.toThrow("CREDENTIAL_UNAVAILABLE");
    await review(credential.id);
    for (const overrides of [{ org: OTHER_ORG }, { user: OTHER }, { role: "psychologist" }, { label: "Forged label" }]) {
      await expect(activate(credential.id, overrides)).rejects.toThrow("CREDENTIAL_APPROVAL_REQUIRED");
    }
    await expect(activate(credential.id, { admin: OTHER })).rejects.toThrow("CREDENTIAL_FORBIDDEN");
  });

  it("rejects expired submissions and rechecks expiration before approval and activation", async () => {
    await asService();
    await expect(db.query(`select * from professional_service.submit_credential(
      $1,$2,'counselor','Synthetic credential',current_date-1,'echo:encrypted:v1:synthetic')`, [ORG, USER])).rejects.toThrow("CREDENTIAL_INVALID");
    const pending = await submit();
    const approved = await submit();
    await review(approved.id);
    // Simulate the passage of a day without weakening the production RPCs.
    await db.exec("reset role; update professional_service.credential_reviews set expires_at=current_date-1");
    await asService();
    await expect(review(pending.id)).rejects.toThrow("CREDENTIAL_EXPIRED");
    await expect(activate(approved.id)).rejects.toThrow("CREDENTIAL_APPROVAL_REQUIRED");
    await review(pending.id, ADMIN, ORG, "rejected", "expired_credential");
  });

  it.each(["organization", "account"])("rechecks inactive %s during review", async (kind) => {
    await asService();
    const credential = await submit();
    const alreadyApproved = await submit();
    await review(alreadyApproved.id);
    await db.exec(kind === "organization"
      ? `reset role; update professional_service.organizations set status='suspended' where id='${ORG}'`
      : `reset role; update user_service.profiles set account_status='suspended' where user_id='${USER}'`);
    await asService();
    await expect(review(credential.id)).rejects.toThrow("CREDENTIAL_FORBIDDEN");
    await expect(activate(alreadyApproved.id)).rejects.toThrow("CREDENTIAL_FORBIDDEN");
  });

  it("fails evidence access and rolls back decisions when audit insertion fails", async () => {
    await asService();
    const credential = await submit();
    await db.exec(`reset role; alter table professional_service.audit_events add constraint test_no_credential_audit
      check (action not in ('credential.evidence_viewed','credential.approved'))`);
    try {
      await asService();
      await expect(db.query("select * from professional_service.read_credential_for_review($1,$2,$3)", [ORG, credential.id, ADMIN])).rejects.toThrow("test_no_credential_audit");
      await expect(review(credential.id)).rejects.toThrow("test_no_credential_audit");
      expect((await db.query("select status from professional_service.credential_reviews where id=$1", [credential.id])).rows[0]).toEqual({ status: "pending" });
    } finally {
      await db.exec("reset role; alter table professional_service.audit_events drop constraint test_no_credential_audit");
    }
  });

  it.each(["anon", "authenticated"])("denies %s direct evidence access, modifications and forged-reviewer RPCs", async (role) => {
    expect((await db.query("select relrowsecurity from pg_class where oid='professional_service.credential_reviews'::regclass")).rows[0]).toEqual({ relrowsecurity: true });
    await asService();
    const credential = await submit();
    await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.role','service_role',false)`);
    await expect(db.exec("select * from professional_service.credential_reviews")).rejects.toThrow(/permission denied/);
    await expect(db.exec(`update professional_service.credential_reviews set status='approved',reviewed_by='${ADMIN}'`)).rejects.toThrow(/permission denied/);
    await expect(review(credential.id, ADMIN)).rejects.toThrow(/permission denied/);
  });
});

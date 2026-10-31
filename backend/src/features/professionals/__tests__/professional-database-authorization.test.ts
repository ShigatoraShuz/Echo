import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const ACTOR = "fe000000-0000-4000-8000-000000000001";
const OWNER = "fe000000-0000-4000-8000-000000000002";
const OTHER = "fe000000-0000-4000-8000-000000000003";
const ORG = "fe000000-0000-4000-8000-000000000004";
const OTHER_ORG = "fe000000-0000-4000-8000-000000000005";
const CASE = "fe000000-0000-4000-8000-000000000006";
let db: PGlite;

async function asService() {
  await db.exec("set role service_role; select set_config('request.jwt.claim.role', 'service_role', false)");
}
async function claim(actor = ACTOR) {
  return db.query("select * from professional_service.claim_request($1,$2)", [CASE, actor]);
}

// Executes the existing migration in memory only. No Supabase connection, env
// secrets, migration deployment, or production permission changes are involved.
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.role() returns text language sql stable as
      $$ select current_setting('request.jwt.claim.role', true) $$;
    create schema user_service;
    create table user_service.profiles(user_id uuid primary key, account_status text,
      eligible_18_plus boolean, onboarding_completed boolean);
    insert into auth.users values ('${ACTOR}'), ('${OWNER}'), ('${OTHER}');
    insert into user_service.profiles values ('${OWNER}', 'active', true, true);
  `);
  await db.exec(await readFile(new URL("../../../../../supabase/migrations/20261010090000_professional_support_portal.sql", import.meta.url), "utf8"));
}, 30_000);

beforeEach(async () => {
  await db.exec(`
    reset role;
    truncate professional_service.organizations cascade;
    insert into professional_service.organizations(id,slug,name,status,verified_at,verified_by)
      values ('${ORG}','synthetic-a','Synthetic A','active',now(),'${OTHER}'),
             ('${OTHER_ORG}','synthetic-b','Synthetic B','active',now(),'${OTHER}');
    insert into professional_service.memberships(organization_id,user_id,role,status,display_name,
      credential_label,credential_expires_at,approved_at,approved_by)
      values ('${ORG}','${ACTOR}','counselor','active','Synthetic Practitioner',
        'Synthetic credential',current_date + 1,now(),'${OTHER}');
    insert into professional_service.support_requests(id,organization_id,user_id,summary_encrypted,
      preferred_time_encrypted,consent_version)
      values ('${CASE}','${ORG}','${OWNER}','echo:encrypted:v1:synthetic',
        'echo:encrypted:v1:synthetic','professional-request-v1');
  `);
});
afterAll(async () => { await db?.close(); });

describe("professional database authorization", () => {
  it.each(["anon", "authenticated"])("denies %s direct reads, self-approval and forged-actor RPCs", async (role) => {
    const rls = await db.query<{ relrowsecurity: boolean }>(`
      select relrowsecurity from pg_class join pg_namespace on pg_namespace.oid=relnamespace
      where nspname='professional_service' and relkind='r'
    `);
    expect(rls.rows).toHaveLength(8);
    expect(rls.rows.every((row) => row.relrowsecurity)).toBe(true);
    await db.exec(`set role ${role}; select set_config('request.jwt.claim.role','service_role',false)`);
    for (const table of ["organizations", "memberships", "support_requests", "shared_journals", "appointments", "case_notes", "referrals", "audit_events"]) {
      await expect(db.query(`select * from professional_service.${table}`)).rejects.toThrow(/permission denied/);
    }
    await expect(db.query("update professional_service.memberships set status='active',role='org_admin' where user_id=$1", [OTHER])).rejects.toThrow(/permission denied/);
    await expect(claim(ACTOR)).rejects.toThrow(/permission denied/);
  });

  it("requires the service-role claim even for callers granted RPC execution", async () => {
    await asService();
    await db.exec("select set_config('request.jwt.claim.role','authenticated',false)");
    await expect(claim()).rejects.toThrow("SERVICE_ROLE_REQUIRED");
  });

  it.each([
    ["absent membership", "delete from professional_service.memberships"],
    ["pending membership", "update professional_service.memberships set status='pending'"],
    ["suspended membership", "update professional_service.memberships set status='suspended'"],
    ["expired credential", "update professional_service.memberships set credential_expires_at=current_date - 1"],
    ["another organization", `update professional_service.memberships set organization_id='${OTHER_ORG}'`],
    ["another actor", `update professional_service.memberships set user_id='${OTHER}'`],
    ["pending organization", `update professional_service.organizations set status='pending' where id='${ORG}'`],
    ["suspended organization", `update professional_service.organizations set status='suspended' where id='${ORG}'`],
  ])("denies claim with %s without assignment or a claim audit", async (_name, setup) => {
    await db.exec(setup);
    await asService();
    await expect(claim()).rejects.toThrow("MEMBERSHIP_REQUIRED");
    expect((await db.query("select status,assigned_to from professional_service.support_requests where id=$1", [CASE])).rows)
      .toEqual([{ status: "submitted", assigned_to: null }]);
    expect((await db.query("select id from professional_service.audit_events where action='request.claimed'")).rows).toEqual([]);
  });

  it.each(["coordinator", "org_admin"])("denies %s clinical claim and forged assigned-author writes", async (role) => {
    await db.query("update professional_service.memberships set role=$1", [role]);
    await asService();
    await expect(claim()).rejects.toThrow("MEMBERSHIP_REQUIRED");
    await db.exec(`reset role; update professional_service.support_requests set assigned_to='${ACTOR}',status='assigned'`);
    await asService();
    await expect(db.query("insert into professional_service.case_notes(request_id,author_user_id,body_encrypted) values($1,$2,'echo:encrypted:v1:synthetic')", [CASE, ACTOR]))
      .rejects.toThrow("ASSIGNMENT_REQUIRED");
    await expect(db.query("insert into professional_service.referrals(request_id,author_user_id,resource_name) values($1,$2,'Synthetic resource')", [CASE, ACTOR]))
      .rejects.toThrow("ASSIGNMENT_REQUIRED");
  });

  it("requires review timestamps, clinical credentials and one of the five defined roles", async () => {
    await expect(db.exec("update professional_service.memberships set approved_at=null")).rejects.toThrow("active_member_reviewed");
    await expect(db.exec("update professional_service.organizations set verified_at=null")).rejects.toThrow("active_organization_verified");
    await expect(db.exec("update professional_service.memberships set credential_label=null")).rejects.toThrow("practitioner_credential_check");
    await expect(db.exec("update professional_service.memberships set role='administrator'")).rejects.toThrow(/check constraint/);
  });

  it.each(["counselor", "psychologist", "social_worker"])("allows approved %s claim, notes, referrals, appointment and close with auditing", async (role) => {
    // An expiry of today remains eligible under the existing contract.
    await db.query("update professional_service.memberships set role=$1,credential_expires_at=current_date", [role]);
    await asService();
    expect((await claim()).rows[0]).toMatchObject({ status: "assigned", assigned_to: ACTOR });
    await db.query("insert into professional_service.case_notes(request_id,author_user_id,body_encrypted) values($1,$2,'echo:encrypted:v1:synthetic')", [CASE, ACTOR]);
    await db.query("insert into professional_service.referrals(request_id,author_user_id,resource_name) values($1,$2,'Synthetic resource')", [CASE, ACTOR]);
    const offer = await db.query<{ id: string }>(`select * from professional_service.propose_appointment(
      $1,$2,now()+interval '1 day',now()+interval '1 day 1 hour','online','echo:encrypted:v1:synthetic')`, [CASE, ACTOR]);
    await expect(db.query("select * from professional_service.cancel_appointment($1,$2)", [offer.rows[0].id, OTHER])).rejects.toThrow("REQUEST_NOT_FOUND");
    await db.query("select * from professional_service.respond_appointment($1,$2,true)", [offer.rows[0].id, OWNER]);
    await db.query("select * from professional_service.cancel_appointment($1,$2)", [offer.rows[0].id, ACTOR]);
    expect((await db.query("select * from professional_service.set_request_status($1,$2,'closed')", [CASE, ACTOR])).rows[0]).toMatchObject({ status: "closed" });
    const audit = await db.query<{ action: string }>("select action from professional_service.audit_events where request_id=$1", [CASE]);
    expect(audit.rows.map((row) => row.action)).toEqual(expect.arrayContaining([
      "request.claimed", "note.created", "referral.created", "appointment.proposed", "appointment.confirmed", "appointment.canceled", "request.closed",
    ]));
  });

  it("rechecks revoked practitioner membership at the mutation boundary while retaining owner cancellation", async () => {
    await asService();
    await claim();
    const offer = await db.query<{ id: string }>(`select * from professional_service.propose_appointment(
      $1,$2,now()+interval '1 day',now()+interval '1 day 1 hour','online','echo:encrypted:v1:synthetic')`, [CASE, ACTOR]);
    await db.exec("reset role; update professional_service.memberships set status='suspended'");
    await asService();
    await expect(db.query("select * from professional_service.cancel_appointment($1,$2)", [offer.rows[0].id, ACTOR])).rejects.toThrow("REQUEST_NOT_FOUND");
    await expect(db.query("insert into professional_service.case_notes(request_id,author_user_id,body_encrypted) values($1,$2,'echo:encrypted:v1:synthetic')", [CASE, ACTOR])).rejects.toThrow("ASSIGNMENT_REQUIRED");
    expect((await db.query("select * from professional_service.cancel_appointment($1,$2)", [offer.rows[0].id, OWNER])).rows[0]).toMatchObject({ status: "canceled" });
  });
});

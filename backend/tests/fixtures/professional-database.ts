import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

export const ids = {
  actor: "fb000000-0000-4000-8000-000000000001", second: "fb000000-0000-4000-8000-000000000002",
  owner: "fb000000-0000-4000-8000-000000000003", admin: "fb000000-0000-4000-8000-000000000004",
  outsider: "fb000000-0000-4000-8000-000000000005", org: "fb000000-0000-4000-8000-000000000006",
  otherOrg: "fb000000-0000-4000-8000-000000000007", request: "fb000000-0000-4000-8000-000000000008",
};
export const encryptedFixture = "echo:encrypted:v1:synthetic-not-real-ciphertext";
export async function serviceRole(db: PGlite) {
  await db.exec("set role service_role; select set_config('request.jwt.claim.role','service_role',false)");
}
export async function professionalDatabase(extraMigrations: string[] = [], beforeExtras?: (db: PGlite) => Promise<void>) {
  const db = new PGlite({ extensions: { btree_gist } });
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.role() returns text language sql stable as $$select current_setting('request.jwt.claim.role',true)$$;
    create schema user_service; create table user_service.profiles(user_id uuid primary key,account_status text,eligible_18_plus boolean,onboarding_completed boolean);
    create schema verification_service; create table verification_service.verification_admins(user_id uuid primary key,is_active boolean);
    insert into auth.users values ('${ids.actor}'),('${ids.second}'),('${ids.owner}'),('${ids.admin}'),('${ids.outsider}');
    insert into user_service.profiles select id,'active',true,true from auth.users;
    insert into verification_service.verification_admins values ('${ids.admin}',true);`);
  for (const name of ["20261010090000_professional_support_portal.sql", ...(extraMigrations.includes("20261020103920_professional_shared_case_snapshot.sql") ? ["20261011100000_user_professional_support_workspace.sql"] : []), "20261012160000_professional_credential_reviews.sql", "20261014100000_professional_owner_request_actions.sql"]) {
    await db.exec(await readFile(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8"));
  }
  if (beforeExtras) await beforeExtras(db);
  for (const name of extraMigrations) {
    await db.exec(await readFile(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8"));
  }
  return db;
}
export async function seedProfessionalDatabase(db: PGlite) {
  await db.exec(`reset role; truncate professional_service.organizations cascade;
    update user_service.profiles set account_status='active',eligible_18_plus=true,onboarding_completed=true;
    insert into professional_service.organizations(id,slug,name,status,verified_at,verified_by)
      values('${ids.org}','synthetic-one','Synthetic organization','active',now(),'${ids.admin}'),
      ('${ids.otherOrg}','synthetic-other','Synthetic other organization','active',now(),'${ids.admin}');`);
  await serviceRole(db);
  for (const actor of [ids.actor, ids.second, ids.outsider]) {
    const org = actor === ids.outsider ? ids.otherOrg : ids.org;
    const credential = (await db.query<{ id: string }>(`select * from professional_service.submit_credential($1,$2,'counselor','Synthetic credential',current_date+1,$3)`, [org, actor, encryptedFixture])).rows[0];
    await db.query("select * from professional_service.review_credential($1,$2,$3,'approved',null)", [org, credential.id, ids.admin]);
    await db.query(`insert into professional_service.memberships(organization_id,user_id,role,status,display_name,credential_label,credential_expires_at,approved_at,approved_by,approved_credential_id)
      values($1,$2,'counselor','active','Synthetic practitioner','Synthetic credential',current_date+1,now(),$3,$4)`, [org, actor, ids.admin, credential.id]);
  }
  await db.exec("reset role");
  await db.query(`insert into professional_service.support_requests(id,organization_id,user_id,summary_encrypted,preferred_time_encrypted,consent_version)
    values($1,$2,$3,$4,$4,'professional-request-v1')`, [ids.request, ids.org, ids.owner, encryptedFixture]);
  await serviceRole(db);
}

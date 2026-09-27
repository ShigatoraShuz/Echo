// Supplemental PostgreSQL/WASM checks. This does not replace local Supabase,
// PostgREST, or Realtime integration validation.
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const database = new PGlite({ extensions: { pgcrypto } });
await database.exec(`
 create role anon; create role authenticated; create role service_role bypassrls;
 create role supabase_auth_admin; create role supabase_storage_admin; create role authenticator;
 create schema auth; create schema storage; create schema extensions;
 create extension pgcrypto with schema extensions;
 set search_path=public,extensions;
 create table auth.users(id uuid primary key default gen_random_uuid(),email text,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}',
   created_at timestamptz default now(),updated_at timestamptz default now(),email_confirmed_at timestamptz,confirmed_at timestamptz);
 create table auth.identities(id text primary key,user_id uuid references auth.users(id),provider text,provider_id text,identity_data jsonb default '{}');
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);
 create function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
 create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}') $$;
 create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role',true) $$;
 grant usage on schema auth to anon,authenticated,service_role;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key,bucket_id text,name text,owner uuid,owner_id text,metadata jsonb);
 alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;
 create publication supabase_realtime;
`);
const directory = new URL("../../supabase/migrations/", import.meta.url);
for (const name of (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort()) {
  try {
    await database.exec(await readFile(new URL(name, directory), "utf8"));
  } catch (error) {
    const sql = await readFile(new URL(name, directory), "utf8");
    console.error(
      JSON.stringify({
        migration: name,
        message: error.message,
        detail: error.detail,
        where: error.where,
        position: error.position,
        internalPosition: error.internalPosition,
        internalQuery: error.internalQuery,
        context: sql.slice(Number(error.position) - 180, Number(error.position) + 180),
      }),
    );
    process.exitCode = 1;
    await database.close();
    process.exit();
  }
}
const tests = new URL("../../supabase/tests/database/", import.meta.url);
for (const name of (await readdir(tests)).filter(
  (name) => (name.startsWith("journal-analysis") || name.startsWith("wellness") || name.startsWith("security-")) && name.endsWith(".sql"),
)) {
  try {
    await database.exec(await readFile(new URL(name, tests), "utf8"));
    console.info(`PASS ${name}`);
  } catch (error) {
    console.error(JSON.stringify({ test: name, message: error.message, detail: error.detail, where: error.where }));
    await database.exec("rollback");
    process.exitCode = 1;
  }
}
console.info(`Supplemental PostgreSQL migration validation: ${fileURLToPath(directory)}`);
if (process.argv.includes("--catalog") && !process.exitCode) {
  const schemas = "('public','user_service','journal_service','buddy_service','verification_service','notification_service','grounding_service','insights_service','ai_analysis','auth_provisioning')";
  const reports = {
    tables: `select n.nspname as schema,c.relname as name,c.relkind,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ${schemas} and c.relkind in ('r','p','v','m') order by 1,2`,
    columns: `select table_schema,table_name,column_name,data_type,is_nullable from information_schema.columns where table_schema in ${schemas} order by table_schema,table_name,ordinal_position`,
    policies: `select * from pg_policies where schemaname in ${schemas} order by schemaname,tablename,policyname`,
    grants: `select table_schema,table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema in ${schemas} order by table_schema,table_name,grantee,privilege_type`,
    column_grants: `select table_schema,table_name,column_name,grantee,privilege_type from information_schema.role_column_grants where table_schema in ${schemas} order by 1,2,3,4,5`,
    schema_grants: `select n.nspname as schema,r.rolname as role,has_schema_privilege(r.rolname,n.oid,'USAGE') as usage,has_schema_privilege(r.rolname,n.oid,'CREATE') as create_objects from pg_namespace n cross join pg_roles r where n.nspname in ${schemas} and r.rolname in ('anon','authenticated','service_role') order by 1,2`,
    default_privileges: `select pg_get_userbyid(d.defaclrole) as owner,n.nspname as schema,d.defaclobjtype as object_type,d.defaclacl::text as privileges from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace where n.nspname in ${schemas} or d.defaclnamespace=0 order by 1,2,3`,
    functions: `select n.nspname as schema,p.proname as name,pg_get_function_identity_arguments(p.oid) as arguments,p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ${schemas} order by 1,2`,
    triggers: `select event_object_schema,event_object_table,trigger_name,action_statement from information_schema.triggers where event_object_schema in ${schemas} order by 1,2,3`,
    constraints: `select n.nspname as schema,c.relname as table_name,k.conname,k.convalidated,pg_get_constraintdef(k.oid) as definition from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ${schemas} order by 1,2,3`,
  };
  const catalog = { source: "Isolated synthetic PostgreSQL after repository migrations; NOT a deployed project snapshot" };
  for (const [name, sql] of Object.entries(reports)) catalog[name] = (await database.query(sql)).rows;
  await writeFile(new URL("../../docs/security/DATABASE_CATALOG.json", import.meta.url), JSON.stringify(catalog, null, 2) + "\n");
  console.info("Wrote isolated schema/policy/grant/function/trigger/constraint catalog.");
}
await database.close();

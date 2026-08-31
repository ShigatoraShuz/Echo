// Supplemental PostgreSQL/WASM checks. This does not replace local Supabase,
// PostgREST, or Realtime integration validation.
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFile, readdir } from "node:fs/promises";
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
 create function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
 create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}') $$;
 create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role',true) $$;
 grant usage on schema auth to anon,authenticated,service_role;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key,bucket_id text,name text,owner uuid,owner_id text,metadata jsonb);
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
  (name) => name.startsWith("journal-analysis") && name.endsWith(".sql"),
)) {
  try {
    await database.exec(await readFile(new URL(name, tests), "utf8"));
    console.info(`PASS ${name}`);
  } catch (error) {
    console.error(JSON.stringify({ test: name, message: error.message, detail: error.detail, where: error.where }));
    process.exitCode = 1;
  }
}
console.info(`Supplemental PostgreSQL migration validation: ${fileURLToPath(directory)}`);
await database.close();

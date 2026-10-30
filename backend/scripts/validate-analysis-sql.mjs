import { readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createDisposableDatabase } from "./disposable-database.mjs";
const database = await createDisposableDatabase();
const directory = new URL("../../supabase/migrations/", import.meta.url);
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

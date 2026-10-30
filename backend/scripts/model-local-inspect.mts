function print(value: unknown) {
  process.stdout.write((typeof value === "string" ? value : JSON.stringify(value)) + "\n");
}
import { readFileSync, readdirSync } from "node:fs";
import { localEnvironment, localSql, FIXTURE_TAG } from "./lib/professional-local-target.mts";
const local = localEnvironment(process.cwd());
const state = JSON.parse(readFileSync("backend/tmp/professional-fixtures/state.json", "utf8"));
if (state.tag !== FIXTURE_TAG || state.fingerprint !== local.fingerprint || !state.complete)
  throw new Error("Fixture mismatch");
print(
  JSON.stringify({
    stateKeys: Object.keys(state),
    accountKeys: Object.keys(state.accounts ?? state.actors ?? {}),
    target: "LOCAL http://127.0.0.1:54321; PostgreSQL 54322",
    mfaEnabled: local.mfaEnabled,
  }),
);
const applied = localSql("select version from supabase_migrations.schema_migrations order by version").split(/\r?\n/);
print(
  JSON.stringify({
    missing: readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql") && !applied.includes(f.split("_")[0])),
  }),
);
print(
  localSql(
    "select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('ai_analysis','buddy_service') and c.relkind='r' order by 1,2",
  ),
);
print(
  localSql(
    "select p.user_id,p.account_status,p.onboarding_completed,p.eligible_18_plus,v.verification_status,v.approved_expires_at, pp.journal_ai_analysis_enabled from auth.users u join user_service.profiles p on p.user_id=u.id left join lateral (select * from verification_service.identity_verifications where user_id=u.id order by created_at desc limit 1) v on true left join user_service.privacy_preferences pp on pp.user_id=u.id where u.email like '%@professional.echo.test' and u.raw_app_meta_data->>'fixture'='echo-professional-local-v1'",
  ),
);

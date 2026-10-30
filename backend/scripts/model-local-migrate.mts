function print(value: unknown) {
  process.stdout.write((typeof value === "string" ? value : JSON.stringify(value)) + "\n");
}
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { localEnvironment, localSql, FIXTURE_TAG } from "./lib/professional-local-target.mts";

// Deliberately narrow local-only dependency workflow. No linked project, remote URL,
// environment database connection, reset, cleanup, or arbitrary migration argument.
const files = [
  "20261012091000_buddy_conversation_pins.sql",
  "20261013010000_buddy_history_controls.sql",
  "20261013012000_buddy_privacy_setting_grant.sql",
  "20261018140000_journal_draft_images.sql",
  "20261029010000_engineering_model_worker_scope.sql",
  "20261029011000_engineering_model_worker_recovery.sql",
  "20261029012000_engineering_recovery_projection_timestamp.sql",
];
const quote = (s: string) => `'${s.replaceAll("'", "''")}'`;
const root = process.cwd();
const fixture = JSON.parse(readFileSync("backend/tmp/professional-fixtures/state.json", "utf8"));
for (const file of files) {
  const target = localEnvironment(root); // Verify target immediately before EACH write.
  if (fixture.tag !== FIXTURE_TAG || fixture.fingerprint !== target.fingerprint || !fixture.complete || fixture.retired)
    throw new Error("Current synthetic local fixture identity required.");
  const version = file.split("_")[0];
  if (localSql(`select count(*) from supabase_migrations.schema_migrations where version=${quote(version)}`) === "1") {
    print(`${file}: already applied locally`);
    continue;
  }
  const sql = readFileSync(`supabase/migrations/${file}`, "utf8");
  const body = sql.replace(/^\s*begin;\s*$/gim, "").replace(/^\s*commit;\s*$/gim, "");
  // SQL + ledger entry commit atomically, mirroring the established migration table.
  localSql(`begin;\n${body}\ninsert into supabase_migrations.schema_migrations(version,name,statements)
    values(${quote(version)},${quote(file.slice(15, -4))},array[${quote(sql)}]);
    notify pgrst,'reload schema';commit;`);
  print(
    JSON.stringify({
      file,
      sha256: createHash("sha256").update(sql).digest("hex"),
      target: "LOCAL PostgreSQL 54322",
      applied: true,
    }),
  );
}
print(
  localSql(
    "select has_function_privilege('authenticated','ai_analysis.claim_engineering_job(text,text,uuid[])','execute'),has_function_privilege('anon','ai_analysis.claim_engineering_job(text,text,uuid[])','execute'),has_function_privilege('service_role','ai_analysis.claim_engineering_job(text,text,uuid[])','execute')",
  ),
);

import { loadEnvironment } from "../src/config/environment.js";
import { createSupabaseAdminClient } from "../src/infrastructure/supabase/supabase-admin.client.js";

const apply = process.argv.includes("--apply");
const database = createSupabaseAdminClient(loadEnvironment());
const [analysis, professional] = await Promise.all([
  database.schema("ai_analysis").rpc("run_retention", { p_dry_run: !apply }),
  database.schema("professional_service").rpc("run_audit_retention", { p_dry_run: !apply }),
]);
if (analysis.error || professional.error) throw new Error("Active-policy retention could not complete.");
process.stdout.write(`${JSON.stringify({ service: "active-policy-retention", dryRun: !apply,
  analysis: analysis.data, professional: professional.data })}\n`);

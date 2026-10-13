import { loadEnvironment } from "../src/config/environment.js";
import { createSupabaseAdminClient } from "../src/infrastructure/supabase/supabase-admin.client.js";

const apply = process.argv.includes("--apply");
if (apply && process.env.PROFESSIONAL_RETENTION_POLICY_APPROVED !== "true") {
  throw new Error("Set PROFESSIONAL_RETENTION_POLICY_APPROVED=true only after the retention policy is approved.");
}

const database = createSupabaseAdminClient(loadEnvironment());
const { data, error } = await database.schema("professional_service").rpc("run_retention", { p_dry_run: !apply });
if (error) throw new Error("Professional support retention failed.");
process.stdout.write(`${JSON.stringify({ service: "professional-retention", ...data })}\n`);

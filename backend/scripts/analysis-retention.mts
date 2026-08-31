import { loadEnvironment } from "../src/config/environment.js";
import { createSupabaseAdminClient } from "../src/infrastructure/supabase/supabase-admin.client.js";

const environment = loadEnvironment();
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(environment.SUPABASE_URL).hostname))
  throw new Error("This validation command only operates on a disposable local database.");
const database = createSupabaseAdminClient(environment);
const { data, error } = await database
  .schema("ai_analysis")
  .rpc("run_retention", { p_dry_run: !process.argv.includes("--apply") });
if (error) throw new Error("Local retention validation failed.");
console.info(JSON.stringify({ service: "analysis-retention", ...data }));

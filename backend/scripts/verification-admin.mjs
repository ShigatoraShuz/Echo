import { createClient } from "@supabase/supabase-js";
import { provisionVerificationAdmin } from "./lib/verification-admin.mjs";

const email = process.argv[2];
const flags = process.argv.slice(3);
const allowed = ["--check", "--grant", "--revoke"];
try {
  if (!email || flags.some((flag) => !allowed.includes(flag)) || flags.length > 1) {
    throw new Error(
      "Usage: npm run admin:super -- person@example.com [--check|--grant|--revoke]. Default is read-only --check.",
    );
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Server Supabase configuration is required.");
  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const result = await provisionVerificationAdmin(client, email, (flags[0] ?? "--check").slice(2));
  process.stdout.write(
    JSON.stringify({ ...result, scope: "verification_review", workspace: "/admin/verifications" }) + "\n",
  );
} catch (error) {
  process.stderr.write((error instanceof Error ? error.message : "Administrator setup failed.") + "\n");
  process.exitCode = 1;
}

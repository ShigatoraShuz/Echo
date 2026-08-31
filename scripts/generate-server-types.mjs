import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";

const schemas = [
  "public",
  "user_service",
  "journal_service",
  "ai_analysis",
  "insights_service",
  "buddy_service",
  "verification_service",
  "notification_service",
  "grounding_service",
  "auth_provisioning",
];
const result = spawnSync("supabase", ["gen", "types", "typescript", "--local", "--schema", schemas.join(",")], {
  encoding: "utf8",
  timeout: 60_000,
});
if (
  result.error ||
  result.status !== 0 ||
  !result.stdout.includes("export type Database") ||
  !schemas.every((schema) => result.stdout.includes(`${schema}:`))
) {
  console.error(
    "Local Supabase type generation failed or omitted required schemas. Existing server types were not changed.",
  );
  process.exitCode = 1;
} else {
  await writeFile(new URL("../backend/src/infrastructure/supabase/database.types.ts", import.meta.url), result.stdout);
  console.info("Generated server-only Supabase types. No frontend service schema types were generated.");
}

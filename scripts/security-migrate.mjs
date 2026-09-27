import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { verifyProjectTarget, AUTHORIZED_PROJECT_REF } from "./security-project-target.mjs";

// Review and run manually. This script does not link projects, reset databases,
// apply migrations, or emit CLI diagnostics (which can include credentials).
try {
  await verifyProjectTarget();
  const linked = (await readFile(new URL("../supabase/.temp/project-ref", import.meta.url), "utf8")).trim();
  if (linked !== AUTHORIZED_PROJECT_REF) throw new Error();
  const result = spawnSync("supabase", ["db", "push", "--linked", "--dry-run"], {
    encoding: "utf8", timeout: 120_000,
  });
  // --linked cannot be safe unless the link exists and has been checked.
  if (result.error || result.status !== 0) throw new Error();
  console.info(`Dry run succeeded for approved non-production target ${AUTHORIZED_PROJECT_REF.slice(0, 4)}…. Review migration history with the owner before applying.`);
} catch {
  console.error("Migration preflight/dry run failed. No migrations were applied.");
  process.exitCode = 1;
}

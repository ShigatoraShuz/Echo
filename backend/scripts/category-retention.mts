import { loadEnvironment } from "../src/config/environment.js";
import { createSupabaseAdminClient } from "../src/infrastructure/supabase/supabase-admin.client.js";

const apply = process.argv.includes("--apply");
const database = createSupabaseAdminClient(loadEnvironment());
const approved = await database.schema("user_service").rpc("category_retention_approved");
if (approved.error) throw new Error("Retention policy state could not be checked.");
if (apply && approved.data !== true) throw new Error("Category retention policy has not been approved.");

let categoryResult: Record<string, unknown> | null = null;
let categoryBatches = 0;
for (let batch = 0; batch < (apply ? 1000 : 1); batch++) {
  const category = await database.schema("user_service").rpc("run_category_retention", { p_dry_run: !apply });
  if (category.error) throw new Error("Category retention failed.");
  categoryResult = category.data as Record<string, unknown>;
  categoryBatches++;
  if (!apply || ["abandonedDrafts", "notifications", "analysisOperationalMetadata"].every(
    (key) => Number(categoryResult?.[key] ?? 0) <= 500,
  )) break;
}
let verificationDocuments = 0;
if (apply) {
  for (let batch = 0; batch < 1000; batch++) {
    const candidates = await database.schema("user_service")
      .rpc("eligible_verification_document_retention", { p_limit: 100 });
    if (candidates.error || !Array.isArray(candidates.data)) throw new Error("Verification retention inventory failed.");
    if (!candidates.data.length) break;
    for (const item of candidates.data) {
      if (typeof item.user_id !== "string" || typeof item.storage_path !== "string" ||
          !item.storage_path.startsWith(`${item.user_id}/`) ||
          !/^[a-zA-Z0-9_./-]+$/.test(item.storage_path) ||
          item.storage_path.split("/").some((part: string) => part === "." || part === ".."))
        throw new Error("Verification document path failed the owner check.");
      const removed = await database.storage.from("verification-documents").remove([item.storage_path]);
      if (removed.error) throw new Error("Verification document storage removal failed.");
      const finished = await database.schema("user_service").rpc("finish_verification_document_retention", {
        p_id: item.document_id, p_source_schema: item.source_schema, p_path: item.storage_path,
      });
      if (finished.error || finished.data !== true) throw new Error("Verification document record removal failed.");
      verificationDocuments++;
    }
  }
} else {
  const candidates = await database.schema("user_service")
    .rpc("eligible_verification_document_retention", { p_limit: 500 });
  if (candidates.error || !Array.isArray(candidates.data)) throw new Error("Verification retention inventory failed.");
  verificationDocuments = candidates.data.length;
}

process.stdout.write(`${JSON.stringify({ service: "category-retention", dryRun: !apply,
  policyApproved: approved.data === true, category: categoryResult, categoryBatches,
  verificationDocuments })}\n`);

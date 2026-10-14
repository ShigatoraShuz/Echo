import { loadEnvironment } from "../config/environment.js";
import { createSupabaseAdminClient } from "../infrastructure/supabase/supabase-admin.client.js";
import { AccountErasureWorker } from "../features/settings/account-erasure.worker.js";

const environment = loadEnvironment();
if (!environment.ACCOUNT_ERASURE_HMAC_KEY_BASE64)
  throw new Error("ACCOUNT_ERASURE_HMAC_KEY_BASE64 is required for the account erasure worker.");
const worker = new AccountErasureWorker(
  createSupabaseAdminClient(environment),
  Buffer.from(environment.ACCOUNT_ERASURE_HMAC_KEY_BASE64, "base64"),
);
async function main() {
  let running = true;
  process.once("SIGINT", () => { running = false; });
  process.once("SIGTERM", () => { running = false; });
  while (running) {
    try { await worker.tick(); }
    catch { console.error(JSON.stringify({ service: "account-erasure", event: "worker_unavailable" })); }
    if (running) await new Promise((resolve) => setTimeout(resolve, 30_000));
  }
}

void main();

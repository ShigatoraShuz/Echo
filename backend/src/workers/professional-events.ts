/** Explicit local retry worker. A single case ID is mandatory; never drain unrelated cases. */
import { setTimeout as sleep } from "node:timers/promises";
import { z } from "zod";
import { loadEnvironment } from "../config/environment.js";
import { createSupabaseAdminClient } from "../infrastructure/supabase/supabase-admin.client.js";
const requestId = z.uuid().parse(process.env.ECHO_PROFESSIONAL_EVENT_REQUEST_ID);
const database = createSupabaseAdminClient(loadEnvironment());
const shutdown = new AbortController();
process.once("SIGINT", () => shutdown.abort());
process.once("SIGTERM", () => shutdown.abort());
async function main() {
  while (!shutdown.signal.aborted) {
    try {
      const result = await database
        .schema("professional_service")
        .rpc("process_case_events", { p_request_id: requestId, p_limit: 10 });
      if (result.error) throw new Error("DELIVERY_UNAVAILABLE");
      process.stdout.write(
        JSON.stringify({
          service: "professional-case-delivery",
          delivered: Number(result.data?.delivered ?? 0),
          failures: Number(result.data?.failures ?? 0),
          pending: Number(result.data?.pending ?? 0),
        }) + "\n",
      );
    } catch {
      process.stderr.write(
        JSON.stringify({ service: "professional-case-delivery", event: "delivery_unavailable" }) + "\n",
      );
    }
    try {
      await sleep(60000, undefined, { signal: shutdown.signal });
    } catch {
      if (!shutdown.signal.aborted) throw new Error("Delivery timer unavailable");
    }
  }
}
void main();

import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, it, vi } from "vitest";
import { ProfessionalService } from "../professional.service.js";
import { createEncryptionService, encryptText } from "../../../infrastructure/encryption/encryption.service.js";
import type { JournalService } from "../../journals/journals.service.js";

const encryption = createEncryptionService(Buffer.alloc(32, 5).toString("base64"), 1);
function setup() {
  let complete!: (value: { data: unknown[]; error: null }) => void;
  const hold = new Promise<{ data: unknown[]; error: null }>(resolve => { complete = resolve; });
  let requestReads = 0, revoke = false;
  const row = { id: "synthetic-case", organization_id: "synthetic-org", user_id: "owner", assigned_to: "actor", status: "assigned",
    summary_encrypted: encryptText("Fictional support request", encryption), sharing_expires_at: "2099-01-01", sharing_revoked_at: null };
  const started = vi.fn();
  const from = (table: string) => {
    const query = {
      select: () => query, eq: () => query,
      maybeSingle: async () => ({ data: table === "support_requests" ? { ...row, sharing_revoked_at: ++requestReads > 1 && revoke ? "2026-01-01" : null }
        : table === "memberships" ? { role: "counselor", status: "active", credential_expires_at: "2099-12-31" } : { status: "active" }, error: null }),
      in: () => { started(table); return table === "appointments" ? hold : Promise.resolve({ data: [{ id: "grant", revoked_at: revoke ? "2026-01-01" : null, expires_at: "2099-01-01" }], error: null }); },
    };
    return query;
  };
  const snapshot = { request: row, sharedJournals: [], sharedRecords: [{ id: "grant", resource_type: "journal", source_record_id: "source", label_encrypted: encryptText("Fictional journal", encryption), payload_encrypted: encryptText("Fictional selected content", encryption), expires_at: "2099-01-01" }],
    appointments: [{ id: "appointment", location_hint_encrypted: encryptText("Fictional location", encryption) }], referrals: [], notes: [] };
  const database = { schema: () => ({ from, rpc: async () => ({ data: structuredClone(snapshot), error: null }) }) } as unknown as SupabaseClient;
  return { service: new ProfessionalService(database, encryption, {} as JournalService), started,
    release: () => complete({ data: [], error: null }), revoke: () => { revoke = true; } };
}
it("starts independent replacement-link and sharing reads together, retaining the final access/consent check", async () => {
  const h = setup(); const read = h.service.detail("actor", "synthetic-case", "professional");
  await vi.waitFor(() => expect(h.started).toHaveBeenCalledWith("appointments"));
  expect(h.started).toHaveBeenCalledWith("case_shared_records");
  h.revoke(); h.release();
  const result = await read;
  expect(result.request.summary).toBeNull(); expect(result.sharedJournals).toEqual([]);
});

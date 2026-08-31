import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AccessService } from "./access.service.js";

const active = ["terms_of_use", "privacy_notice", "ai_analysis_notice"].map((type, i) => ({
  id: `policy-${i}`,
  document_type: type,
  version: "2026-08-31.1",
}));
function fixture(data: typeof active | null = active, error: unknown = null) {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const table = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data, error }), upsert };
  const database = { schema: vi.fn().mockReturnThis(), from: vi.fn().mockReturnValue(table) };
  return { service: new AccessService(database as unknown as SupabaseClient), upsert, database };
}
describe("Version-bound policy acknowledgement", () => {
  it("records only the exact versions reviewed and never changes optional AI preferences", async () => {
    const { service, upsert, database } = fixture();
    await service.acceptCurrentPolicies(
      "user",
      active.map((p) => p.id),
    );
    const rows = upsert.mock.calls[0][0];
    expect(rows).toHaveLength(3);
    expect(rows.every((row: { consent_version: string }) => row.consent_version === "2026-08-31.1")).toBe(true);
    expect(database.from.mock.calls.map(([name]) => name)).toEqual(["policy_documents", "user_consents"]);
    expect(rows.map((row: { consent_type: string }) => row.consent_type)).not.toContain("journal_ai_analysis");
  });
  it.each([["old-1", "old-2", "old-3"], ["policy-0", "policy-0", "policy-2"], ["policy-0"]])(
    "rejects stale, duplicate or incomplete reviewed IDs: %s",
    async (...ids) => {
      const { service, upsert } = fixture();
      await expect(service.acceptCurrentPolicies("user", ids)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
      expect(upsert).not.toHaveBeenCalled();
    },
  );
  it("fails closed when active policies cannot be loaded", async () => {
    const { service, upsert } = fixture(null, { message: "offline" });
    await expect(
      service.acceptCurrentPolicies(
        "user",
        active.map((p) => p.id),
      ),
    ).rejects.toMatchObject({ code: "POLICIES_UNAVAILABLE" });
    expect(upsert).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EncryptionService } from "../../../infrastructure/encryption/encryption.service.js";
import { VerificationService } from "../verification.service.js";

function harness(admin: boolean, row: Record<string, unknown> | null = null) {
  let table = "";
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({
      data: table === "verification_admins" ? (admin ? { user_id: "reviewer" } : null) : row,
      error: null,
    })),
    order: vi.fn(async () => ({ data: [], error: null })),
  };
  const db = {
    schema: vi.fn().mockReturnThis(),
    from: vi.fn((name) => {
      table = name;
      return chain;
    }),
  };
  return {
    service: new VerificationService(
      db as unknown as SupabaseClient,
      { encrypt: vi.fn(), decrypt: vi.fn() } as EncryptionService,
    ),
    chain,
    db,
  };
}
describe("Verification administrator authorization", () => {
  it.each(["list", "detail", "claim", "decision"])(
    "rejects a non-admin before %s data is accessed",
    async (operation) => {
      const { service, db } = harness(false);
      const call =
        operation === "list"
          ? service.listForAdmin("ordinary")
          : operation === "detail"
            ? service.getForAdmin("ordinary", "application")
            : operation === "claim"
              ? service.claimForReview("ordinary", "application")
              : service.decide("ordinary", "application", { decision: "approved", reasonCode: null, note: null });
      await expect(call).rejects.toMatchObject({ statusCode: 403 });
      expect(db.from.mock.calls.map(([name]) => name)).toEqual(["verification_admins"]);
      expect(db.schema).toHaveBeenCalledWith("verification_service");
    },
  );
  it("prevents an administrator deciding their own application", async () => {
    const { service, chain } = harness(true, { user_id: "reviewer", verification_status: "under_review" });
    await expect(
      service.decide("reviewer", "application", { decision: "approved", reasonCode: null, note: null }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(chain.update).not.toHaveBeenCalled();
  });
  it.each(["submitted", "approved", "rejected"])("rejects a decision in %s state", async (state) => {
    const { service, chain } = harness(true, { user_id: "applicant", verification_status: state });
    await expect(
      service.decide("reviewer", "application", { decision: "approved", reasonCode: null, note: null }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(chain.update).not.toHaveBeenCalled();
  });
  it("does not approve an application without required evidence", async () => {
    const { service, chain } = harness(true, {
      user_id: "applicant",
      verification_status: "under_review",
      is_minor: false,
    });
    await expect(
      service.decide("reviewer", "application", { decision: "approved", reasonCode: null, note: null }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(chain.update).not.toHaveBeenCalled();
  });
});

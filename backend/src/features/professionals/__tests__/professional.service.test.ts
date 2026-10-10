import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createEncryptionService, encryptText } from "../../../infrastructure/encryption/encryption.service.js";
import { AuthorizationError } from "../../../shared/errors/app-error.js";
import type { JournalService } from "../../journals/journals.service.js";
import { ProfessionalService } from "../professional.service.js";

const USER = "fe000000-0000-4000-8000-000000000001";
const OTHER = "fe000000-0000-4000-8000-000000000002";
const ORG = "fe000000-0000-4000-8000-000000000003";
const REQUEST = "fe000000-0000-4000-8000-000000000004";
const encryption = createEncryptionService(Buffer.alloc(32, 1).toString("base64"), 1);

function harness(assignedTo: string, revoked: boolean) {
  const row = {
    id: REQUEST,
    organization_id: ORG,
    user_id: OTHER,
    assigned_to: assignedTo,
    status: "assigned",
    summary_encrypted: encryptText("A private message", encryption),
    preferred_time_encrypted: encryptText("After my therapy session", encryption),
    shared_journal_ids: [],
    sharing_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    sharing_revoked_at: revoked ? new Date().toISOString() : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const from = vi.fn((table: string) => {
    const result =
      table === "support_requests"
        ? row
        : table === "memberships"
          ? { role: "counselor", status: "active", credential_expires_at: "2099-12-31" }
          : table === "organizations"
            ? { status: "active" }
            : null;
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({ data: result, error: null }),
      order: async () => ({ data: [], error: null }),
      insert: async () => ({ data: null, error: null }),
      then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => resolve({ data: [], error: null }),
    };
    return query;
  });
  const database = { schema: () => ({ from }) } as unknown as SupabaseClient;
  return { service: new ProfessionalService(database, encryption, {} as JournalService), from };
}

describe("professional case access", () => {
  it("does not open a case assigned to another practitioner", async () => {
    const { service, from } = harness(OTHER, false);
    await expect(service.detail(USER, REQUEST, "professional")).rejects.toBeInstanceOf(AuthorizationError);
    expect(from).not.toHaveBeenCalledWith("shared_journals");
    expect(from).not.toHaveBeenCalledWith("audit_events");
  });

  it("removes submitted content after sharing is revoked", async () => {
    const { service, from } = harness(USER, true);
    const detail = await service.detail(USER, REQUEST, "professional");
    expect(detail.request.summary).toBeNull();
    expect(detail.request.preferredTime).toBe("");
    expect(detail.sharedJournals).toEqual([]);
    expect(from).not.toHaveBeenCalledWith("shared_journals");
    expect(from).toHaveBeenCalledWith("audit_events");
  });

  it("decrypts the submitted message only for the assigned practitioner with active sharing", async () => {
    const { service } = harness(USER, false);
    const detail = await service.detail(USER, REQUEST, "professional");
    expect(detail.request.summary).toBe("A private message");
    expect(detail.request.preferredTime).toBe("After my therapy session");
  });
});

describe("professional membership access status", () => {
  it("reports active, expired, suspended, and pending access without granting a role to sign-in alone", async () => {
    const rows = [
      { id: "m1", organization_id: ORG, role: "counselor", status: "active", credential_expires_at: "2099-12-31" },
      { id: "m2", organization_id: "expired", role: "psychologist", status: "active", credential_expires_at: "2020-01-01" },
      { id: "m3", organization_id: "suspended", role: "coordinator", status: "active", credential_expires_at: null },
      { id: "m4", organization_id: "pending", role: "org_admin", status: "pending", credential_expires_at: null },
      { id: "m5", organization_id: "org-pending", role: "coordinator", status: "active", credential_expires_at: null },
      { id: "m6", organization_id: "member-suspended", role: "coordinator", status: "suspended", credential_expires_at: null },
    ];
    const organizations = [
      { id: ORG, status: "active" },
      { id: "expired", status: "active" },
      { id: "suspended", status: "suspended" },
      { id: "pending", status: "active" },
      { id: "org-pending", status: "pending" },
      { id: "member-suspended", status: "active" },
    ];
    const from = (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        order: async () => ({ data: rows, error: null }),
        in: async () => ({ data: organizations, error: null }),
      };
      expect(["memberships", "organizations"]).toContain(table);
      return query;
    };
    const database = { schema: () => ({ from }) } as unknown as SupabaseClient;
    const service = new ProfessionalService(database, encryption, {} as JournalService);
    const result = await service.memberships(USER);
    expect(result.memberships.map((item) => item.accessState)).toEqual([
      "active", "credential_expired", "suspended_organization", "pending_membership",
      "pending_organization", "suspended_membership",
    ]);
  });
});

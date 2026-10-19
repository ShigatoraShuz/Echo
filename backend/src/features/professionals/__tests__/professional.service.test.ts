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
const APPOINTMENT = "fe000000-0000-4000-8000-000000000005";
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
          : table === "appointments"
            ? { request_id: REQUEST, starts_at: new Date(Date.now() + 86_400_000).toISOString() }
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
  const rpc = vi.fn();
  const database = { schema: () => ({ from, rpc }) } as unknown as SupabaseClient;
  return { service: new ProfessionalService(database, encryption, {} as JournalService), from, rpc };
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

describe("appointment completion", () => {
  it("refuses completion before the scheduled start", async () => {
    const { service, rpc } = harness(USER, false);
    await expect(service.completeAppointment(USER, APPOINTMENT)).rejects.toMatchObject({ code: "APPOINTMENT_NOT_STARTED" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("checks the assigned practitioner before revealing appointment timing", async () => {
    const { service, rpc } = harness(OTHER, false);
    await expect(service.completeAppointment(USER, APPOINTMENT)).rejects.toBeInstanceOf(AuthorizationError);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("professional membership access status", () => {
  it("reports active, expired, suspended, and pending access without granting a role to sign-in alone", async () => {
    const rows = [
      { id: "m1", organization_id: ORG, role: "counselor", status: "active", credential_expires_at: "2099-12-31" },
      {
        id: "m2",
        organization_id: "expired",
        role: "psychologist",
        status: "active",
        credential_expires_at: "2020-01-01",
      },
      { id: "m3", organization_id: "suspended", role: "coordinator", status: "active", credential_expires_at: null },
      { id: "m4", organization_id: "pending", role: "org_admin", status: "pending", credential_expires_at: null },
      { id: "m5", organization_id: "org-pending", role: "coordinator", status: "active", credential_expires_at: null },
      {
        id: "m6",
        organization_id: "member-suspended",
        role: "coordinator",
        status: "suspended",
        credential_expires_at: null,
      },
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
      "active",
      "credential_expired",
      "suspended_organization",
      "pending_membership",
      "pending_organization",
      "suspended_membership",
    ]);
  });
});

describe("user support overview", () => {
  it("returns only recent messages from the user's active case", async () => {
    const createdAt = "2026-10-12T01:00:00.000Z";
    const gte = vi.fn();
    const from = vi.fn((table: string) => {
      let columns = "";
      const query = {
        select: (value: string) => {
          columns = value;
          return query;
        },
        in: () => query,
        eq: () => query,
        neq: () => query,
        gte: (field: string, value: string) => {
          gte(field, value);
          return query;
        },
        order: () => query,
        limit: async () => ({
          data:
            table === "case_messages" && columns.includes("body_encrypted")
              ? [
                  {
                    id: "m1",
                    request_id: REQUEST,
                    sender_kind: "professional",
                    body_encrypted: encryptText("Your appointment is ready", encryption),
                    created_at: createdAt,
                  },
                ]
              : [],
          error: null,
        }),
        then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
          resolve({
            data:
              table === "case_messages" ? [{ request_id: REQUEST, sender_user_id: OTHER, created_at: createdAt }] : [],
            error: null,
          }),
      };
      return query;
    });
    const database = { schema: () => ({ from }) } as unknown as SupabaseClient;
    const service = new ProfessionalService(database, encryption, {} as JournalService);
    vi.spyOn(service, "listOwnRequests").mockResolvedValue({
      requests: [
        {
          id: REQUEST,
          organizationId: ORG,
          assignedTo: null,
          status: "submitted",
          createdAt,
          updatedAt: createdAt,
          sharingActive: true,
          sharedJournalCount: 0,
          sharedPhq8Count: 0,
        },
      ],
    } as never);
    vi.spyOn(service, "listOrganizations").mockResolvedValue({ organizations: [] });
    vi.spyOn(service, "directory").mockResolvedValue({ practitioners: [], nextCursor: null });
    const overview = await service.hub(USER);
    expect(overview.recentMessages).toEqual([
      { id: "m1", requestId: REQUEST, sender: "professional", body: "Your appointment is ready", createdAt },
    ]);
    expect(overview.unreadCount).toBe(1);
    expect(gte).toHaveBeenCalledWith("starts_at", expect.any(String));
  });
});

describe("owner calendar appointments", () => {
  it("filters dates through the owner relationship without limiting appointments to recent cases", async () => {
    const owner = vi.fn().mockReturnThis();
    const fromDate = vi.fn().mockReturnThis();
    const untilDate = vi.fn().mockReturnThis();
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: owner,
      gte: fromDate,
      lt: untilDate,
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const from = vi.fn(() => query);
    const database = { schema: () => ({ from }) } as unknown as SupabaseClient;
    const service = new ProfessionalService(database, encryption, {} as JournalService);
    const range = { from: "2026-10-01T00:00:00.000Z", to: "2026-11-01T00:00:00.000Z" };

    await expect(service.listOwnAppointments(USER, range)).resolves.toEqual({ appointments: [] });
    expect(query.select).toHaveBeenCalledWith(expect.stringContaining("support_requests!inner()"));
    expect(owner).toHaveBeenCalledWith("support_requests.user_id", USER);
    expect(fromDate).toHaveBeenCalledWith("starts_at", range.from);
    expect(untilDate).toHaveBeenCalledWith("starts_at", range.to);
  });
});

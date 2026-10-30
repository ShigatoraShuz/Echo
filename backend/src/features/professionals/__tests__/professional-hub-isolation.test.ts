import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { JournalService } from "../../journals/journals.service.js";
import { createEncryptionService } from "../../../infrastructure/encryption/encryption.service.js";
import { ProfessionalService } from "../professional.service.js";

it("keeps one clinician's different organization profiles on their matching owner cases", async () => {
  const organizations = ["org-one", "org-two"].map(id => ({ id, name: `Fictional ${id}` }));
  const members = organizations.map(org => ({ id: `membership-${org.id}`, user_id: "fictional-clinician", organization_id: org.id, role: "counselor", display_name: `Fictional ${org.id} clinician` }));
  const from = vi.fn((table: string) => {
    const query = {
      select: () => query, in: () => query, eq: () => query, neq: () => query, gte: () => query, order: () => query, limit: () => query,
      then: (resolve: (value: object) => unknown) => resolve({ error: null, data: table === "memberships" ? members : table === "practitioner_profiles" ? members.map(m => ({ id: `profile-${m.id}`, membership_id: m.id })) : [] }),
    };
    return query;
  });
  const service = new ProfessionalService({ schema: () => ({ from }) } as unknown as SupabaseClient, createEncryptionService(Buffer.alloc(32, 7).toString("base64"), 1), {} as JournalService);
  vi.spyOn(service, "listOwnRequests").mockResolvedValue({ requests: organizations.map(org => ({ id: `request-${org.id}`, organizationId: org.id, assignedTo: "fictional-clinician", status: "assigned" })) } as never);
  vi.spyOn(service, "listOrganizations").mockResolvedValue({ organizations } as never);
  vi.spyOn(service, "directory").mockResolvedValue({ practitioners: [], nextCursor: null });
  const overview = await service.hub("fictional-student");
  expect(overview.activeCases.map(item => (item as unknown as { assignedProfessional: { organizationId: string } }).assignedProfessional.organizationId)).toEqual(["org-one", "org-two"]);
});

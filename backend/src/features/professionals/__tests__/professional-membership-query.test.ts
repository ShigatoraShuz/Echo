import { createClient } from "@supabase/supabase-js";
import { expect, it, vi } from "vitest";
import { ProfessionalService } from "../professional.service.js";
import { createEncryptionService } from "../../../infrastructure/encryption/encryption.service.js";
import type { JournalService } from "../../journals/journals.service.js";

const actor = "fe000000-0000-4000-8000-000000000001";
const organization = { id: "fe000000-0000-4000-8000-000000000002", name: "Fictional organization", status: "active" };
const member = { id: "fictional-membership", organization_id: organization.id, role: "counselor", status: "active", credential_expires_at: "2099-12-31", organization };
function setup(rows: unknown[], status = 200) {
  const fetch = vi.fn(async () => new Response(JSON.stringify(rows), { status, headers: { "Content-Type": "application/json" } }));
  const client = createClient("http://127.0.0.1:9", "synthetic-local-key", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch } });
  return { service: new ProfessionalService(client, createEncryptionService(Buffer.alloc(32, 2).toString("base64"), 1), {} as JournalService), fetch };
}
it("uses the real SDK FK embedding in a single owner-filtered HTTP request", async () => {
  const h = setup([member]); const result = await h.service.memberships(actor);
  expect(result.memberships[0]).toMatchObject({ organizationId: organization.id, accessState: "active", organization: { id: organization.id } });
  expect(h.fetch).toHaveBeenCalledTimes(1);
  const url = new URL(String((h.fetch.mock.calls as unknown as [string, RequestInit][])[0][0]));
  expect(url.hostname).toBe("127.0.0.1"); expect(url.pathname).toBe("/rest/v1/memberships");
  expect(url.searchParams.get("user_id")).toBe("eq." + actor);
  expect(url.searchParams.get("select")).toContain("organization:organizations(id,slug,name,description,service_hours,status)");
  expect(url.searchParams.get("select")).not.toContain("*");
});
it.each([null, [], { ...organization, id: "wrong-organization" }])("fails closed for a missing or mismatched embedded organization (%j)", async embedded => {
  const h = setup([{ ...member, organization: embedded }]);
  expect((await h.service.memberships(actor)).memberships[0].accessState).toBe("pending_organization");
  expect(h.fetch).toHaveBeenCalledTimes(1);
});

import { it, expect, vi } from "vitest";
import { VerificationService } from "./verification.service.js";
const contact = {
  contact_name: "Support Person",
  relationship: "Friend",
  contact_phone: "09171234567",
  contact_email: null,
  permission_acknowledged_at: "2026-09-01",
};
function harness(status: string | null, contacts: unknown[]) {
  const calls: any[] = [];
  const db = {
    from: (table: string) => {
      const query: any = {
        select: () => query,
        eq: vi.fn((...args: any[]) => {
          calls.push(args);
          return query;
        }),
        maybeSingle: async () => ({ data: status ? { verification_status: status } : null, error: null }),
        then: (resolve: any) => Promise.resolve(resolve({ data: contacts, error: null })),
      };
      return query;
    },
  };
  return { service: new VerificationService(db as any, {} as any, {} as any), calls };
}
it.each([
  [null, [], ["verification", "trusted_contact"]],
  ["pending", [contact], ["verification"]],
  ["approved", [], ["trusted_contact"]],
  ["expired", [contact], ["verification"]],
])("blocks incomplete feature requirements %s", async (status, contacts, missing) => {
  const { service, calls } = harness(status as string | null, contacts as unknown[]);
  expect(await service.featurePolicy("owner")).toMatchObject({
    canUseAiFeatures: false,
    canUseBuddy: false,
    missingRequirements: missing,
  });
  await expect(service.assertAiAccess("owner")).rejects.toMatchObject({
    code: "FEATURE_REQUIREMENTS_NOT_MET",
    statusCode: 403,
  });
  expect(calls.every((args) => args[0] === "user_id" && args[1] === "owner")).toBe(true);
});
it("allows only approved users with a valid acknowledged support contact", async () => {
  const { service } = harness("approved", [contact]);
  expect(await service.featurePolicy("owner")).toMatchObject({
    canUseAiFeatures: true,
    canUseBuddy: true,
    hasTrustedContact: true,
  });
  await expect(service.assertAiAccess("owner")).resolves.toBeUndefined();
});
it.each([
  { ...contact, permission_acknowledged_at: null },
  { ...contact, contact_phone: "invalid" },
  { ...contact, contact_phone: "-------" },
  { ...contact, contact_phone: "1234567890123456" },
  { ...contact, contact_name: "" },
  { ...contact, relationship: "" },
])("rejects invalid legacy support contacts", async (invalid) => {
  expect((await harness("approved", [invalid]).service.featurePolicy("owner")).hasTrustedContact).toBe(false);
});

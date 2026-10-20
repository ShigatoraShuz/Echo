import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createEncryptionService, decryptText } from "../../../infrastructure/encryption/encryption.service.js";
import { NotFoundError } from "../../../shared/errors/app-error.js";
import type { JournalService } from "../../journals/journals.service.js";
import { ProfessionalService } from "../professional.service.js";
import { ids } from "../../../../tests/fixtures/professional-database.js";
const encryption = createEncryptionService(Buffer.alloc(32, 7).toString("base64"), 1);
const input = { organizationId: ids.org, summary: "Synthetic owner support request", preferredTime: "Synthetic afternoon", journalIds: [ids.request] };
function harness() {
  const get = vi.fn().mockResolvedValue({ id: ids.request, title: "Synthetic title", body: "Synthetic reflection",
    phq8_score: 99, risk_score: 99, summary: "Synthetic analysis", images: [{ url: "https://example.invalid/private" }] });
  const rpc = vi.fn().mockResolvedValue({ data: { id: ids.request }, error: null });
  const service = new ProfessionalService({ schema: () => ({ rpc }) } as unknown as SupabaseClient, encryption, { get } as unknown as JournalService);
  return { service, get, rpc };
}
describe("BE-015/016 owner-selected encrypted journal scope", () => {
  it("resolves journals through owner-authorized source and snapshots only title/body, never assessment or images", async () => {
    const h = harness(); await h.service.createRequest(ids.owner, input);
    expect(h.get).toHaveBeenCalledWith(ids.owner, ids.request);
    const args = h.rpc.mock.calls[0][1];
    expect(args.p_user_id).toBe(ids.owner); expect(args.p_consent_version).toBe("professional-request-v1");
    const selected = args.p_shared_items[0];
    expect(Object.keys(selected).sort()).toEqual(["bodyEncrypted", "journalId", "titleEncrypted"]);
    expect(decryptText(selected.titleEncrypted, encryption)).toBe("Synthetic title");
    expect(decryptText(selected.bodyEncrypted, encryption)).toBe("Synthetic reflection");
    expect(JSON.stringify(args)).not.toMatch(/Synthetic|private|phq8|risk_score|images/);
  });
  it.each(["foreign owner", "deleted journal", "missing journal"])("does not persist any request if the source denies a %s", async () => {
    const h = harness(); h.get.mockRejectedValue(new NotFoundError());
    await expect(h.service.createRequest(ids.owner, input)).rejects.toMatchObject({ statusCode: 404 });
    expect(h.rpc).not.toHaveBeenCalled();
  });
  it("rejects duplicate IDs before resolving sources or writing", async () => {
    const h = harness(); await expect(h.service.createRequest(ids.owner, { ...input, journalIds: [ids.request, ids.request] })).rejects.toMatchObject({ statusCode: 409 });
    expect(h.get).not.toHaveBeenCalled(); expect(h.rpc).not.toHaveBeenCalled();
  });
  it("creates an explicit message-only grant without querying journal or analysis sources", async () => {
    const h = harness(); await h.service.createRequest(ids.owner, { ...input, journalIds: [] });
    expect(h.get).not.toHaveBeenCalled(); expect(h.rpc.mock.calls[0][1].p_shared_items).toEqual([]);
  });
  it.each(["INVALID_REQUEST", "INVALID_SHARED_ITEM"])("maps invalid SQL consent input %s to a safe validation error", async (message) => {
    const h = harness(); h.rpc.mockResolvedValue({ data: null, error: { message } });
    await expect(h.service.createRequest(ids.owner, input)).rejects.toMatchObject({ statusCode: 400 });
  });
});

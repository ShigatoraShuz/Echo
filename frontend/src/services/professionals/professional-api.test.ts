import { afterEach, expect, it, vi } from "vitest";
const client = vi.hoisted(() => ({ patch: vi.fn(), post: vi.fn(), get: vi.fn() }));
vi.mock("@/infrastructure/api/api-client", () => ({ createApiClient: () => client }));
vi.mock("@/infrastructure/api/supabase-auth-token-provider", () => ({ supabaseAuthTokenProvider: {} }));
import { professionalApi } from "./professional-api";
afterEach(() => vi.resetAllMocks());

it("uses case-scoped follow-ups, preserves revision and never converts a failure to success", async () => {
  client.get.mockResolvedValue({ data: { items: [], total: 0, hasMore: false, limit: 100 } });
  expect((await professionalApi.followUps("synthetic")).total).toBe(0);
  expect(client.get).toHaveBeenCalledWith("/professional/cases/synthetic/follow-ups");
  client.post.mockRejectedValue(new Error("Synthetic conflict"));
  await expect(professionalApi.completeFollowUp("synthetic", "follow-up", 3)).rejects.toThrow("Synthetic conflict");
  expect(client.post).toHaveBeenCalledWith("/professional/cases/synthetic/follow-ups/follow-up/complete", { expectedRevision: 3 });
});

it("uses the atomic appointment replacement endpoint and returns only server acknowledgment", async () => {
  const input = { startsAt: "2099-01-01T10:00:00Z", endsAt: "2099-01-01T11:00:00Z", mode: "online" as const, locationHint: "Synthetic room" };
  const data = { appointmentId: "synthetic-replacement", status: "proposed" };
  client.post.mockResolvedValue({ success: true, data });
  expect(await professionalApi.rescheduleAppointment("synthetic-old", input)).toEqual(data);
  expect(client.post).toHaveBeenCalledWith("/professional/appointments/synthetic-old/reschedule", input);
});

it("loads dashboard totals for the selected organization without a client-supplied actor", async () => {
  const data = { organizationId: "synthetic-org", counts: { pendingCount: 205 } };
  client.get.mockResolvedValue({ success: true, data });
  expect(await professionalApi.dashboard("synthetic-org")).toEqual(data);
  expect(client.get).toHaveBeenCalledWith("/professional/organizations/synthetic-org/dashboard");
});

it("unwraps owner update acknowledgment without supplying an actor or organization", async () => {
  const result = { request: { id: "synthetic", status: "submitted" } };
  client.patch.mockResolvedValue({ success: true, data: result });
  const input = { summary: "Fictional request message", preferredTime: "Fictional preference" };
  expect(await professionalApi.updateOwnRequest("synthetic", input)).toEqual(result);
  expect(client.patch).toHaveBeenCalledWith("/professional/my-requests/synthetic", input);
});
it("uses the authenticated owner's withdrawal endpoint and propagates failures", async () => {
  client.post.mockRejectedValue(new Error("Synthetic unavailable service"));
  await expect(professionalApi.withdrawOwnRequest("synthetic")).rejects.toThrow("Synthetic unavailable service");
  expect(client.post).toHaveBeenCalledWith("/professional/my-requests/synthetic/cancel", {});
});
it("preserves the legacy queue URL and supports encoded filters with exact page metadata", async () => {
  const data = { requests: [], page: { total: 205, limit: 100, offset: 0, hasMore: true } };
  client.get.mockResolvedValue({ success: true, data });
  expect(await professionalApi.queue("synthetic-org")).toEqual(data);
  expect(client.get).toHaveBeenLastCalledWith("/professional/organizations/synthetic-org/queue");
  await professionalApi.queue("synthetic-org", { status: "assigned", assignedTo: "me", createdThrough: "2026-10-14", limit: 20, offset: 40 });
  expect(client.get).toHaveBeenLastCalledWith("/professional/organizations/synthetic-org/queue?status=assigned&assignedTo=me&createdThrough=2026-10-14&limit=20&offset=40");
});

it("uses authenticated organization notification reads and server read acknowledgement without client actor fields", async () => {
  const data = { items: [], total: 0, hasMore: false, limit: 50 };
  client.get.mockResolvedValue({ success: true, data });
  expect(await professionalApi.notifications("synthetic/org")).toEqual(data);
  expect(client.get).toHaveBeenCalledWith("/professional/organizations/synthetic%2Forg/notifications");
  client.patch.mockResolvedValue({ success: true, data: { id: "notice", readAt: "2026-10-20T00:00:00Z" } });
  expect(await professionalApi.readNotification("synthetic-org", "notice")).toEqual({ id: "notice", readAt: "2026-10-20T00:00:00Z" });
  expect(client.patch).toHaveBeenCalledWith("/professional/organizations/synthetic-org/notifications/notice/read", {});
  client.patch.mockRejectedValue(new Error("Synthetic denied"));
  await expect(professionalApi.readNotification("synthetic-org", "notice")).rejects.toThrow("Synthetic denied");
});


it("connects credential application/review APIs without client actor or approval timestamps",async()=>{
 client.get.mockResolvedValue({data:{credentials:[]}});await professionalApi.credentials();expect(client.get).toHaveBeenLastCalledWith("/professional/credentials");
 await professionalApi.adminCredentials("synthetic/org");expect(client.get).toHaveBeenLastCalledWith("/professional/admin/organizations/synthetic%2Forg/credentials");
 await professionalApi.adminCredential("synthetic-org","credential/one");expect(client.get).toHaveBeenLastCalledWith("/professional/admin/organizations/synthetic-org/credentials/credential%2Fone");
 client.post.mockResolvedValue({data:{credential:{id:"fixture"}}});const input={organizationId:"synthetic-org",role:"counselor" as const,credentialLabel:"Fictional qualification",expiresAt:"2099-01-01",evidenceReference:"Fictional approved-channel locator"};
 await professionalApi.submitCredential(input);expect(client.post).toHaveBeenLastCalledWith("/professional/credentials",input);
 await professionalApi.decideCredential("synthetic-org","fixture",{decision:"rejected",reasonCode:"unable_to_verify"});expect(client.post).toHaveBeenLastCalledWith("/professional/admin/organizations/synthetic-org/credentials/fixture/decision",{decision:"rejected",reasonCode:"unable_to_verify"});
 const membership={organizationId:"synthetic-org",userId:"fictional",role:"counselor" as const,displayName:"Fictional counselor",credentialLabel:input.credentialLabel,credentialExpiresAt:input.expiresAt,credentialChecked:true as const,credentialId:"review-id"};
 await professionalApi.approveMember(membership);expect(client.post).toHaveBeenLastCalledWith("/professional/admin/memberships",membership);
});

it("corrects an existing pending application without posting a new one",async()=>{client.patch.mockResolvedValue({data:{credential:{id:"existing"}}});await professionalApi.correctCredential("existing/id",{credentialLabel:"Synthetic reference",expiresAt:"2099-12-31"});expect(client.patch).toHaveBeenCalledWith("/professional/credentials/existing%2Fid",{credentialLabel:"Synthetic reference",expiresAt:"2099-12-31"});expect(client.post).not.toHaveBeenCalled();});

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

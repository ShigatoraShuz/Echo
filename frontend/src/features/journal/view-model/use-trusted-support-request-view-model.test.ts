import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTrustedSupportRequestViewModel } from "./use-trusted-support-request-view-model";

const service = vi.hoisted(() => ({ getTrustedSupportContacts: vi.fn(), requestTrustedSupportContact: vi.fn() }));
vi.mock("@/services/journal/trusted-support.service", () => service);

describe("trusted support request view model", () => {
  beforeEach(() => { service.getTrustedSupportContacts.mockReset(); service.requestTrustedSupportContact.mockReset(); });

  it("requires a selected contact and consent before submitting a reviewed request", async () => {
    service.getTrustedSupportContacts.mockResolvedValue([{ id: "contact-1", contactName: "Test person", relationship: "friend" }]);
    service.requestTrustedSupportContact.mockResolvedValue(undefined);
    const { result } = renderHook(() => useTrustedSupportRequestViewModel("job-1"));
    await act(async () => result.current.choose());
    await act(async () => result.current.request());
    expect(service.requestTrustedSupportContact).not.toHaveBeenCalled();
    act(() => { result.current.setContactId("contact-1"); result.current.setConsent(true); });
    await act(async () => result.current.request());
    expect(service.requestTrustedSupportContact).toHaveBeenCalledWith("job-1", "contact-1");
    expect(result.current.notice).toMatch(/awaiting review.*No one has been contacted/);
  });

  it("reports a failed contact request without claiming anyone was notified", async () => {
    service.requestTrustedSupportContact.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useTrustedSupportRequestViewModel("job-1"));
    act(() => { result.current.setContactId("contact-1"); result.current.setConsent(true); });
    await act(async () => result.current.request());
    expect(result.current.notice).toMatch(/could not be approved/);
    expect(result.current.busy).toBe(false);
  });
});

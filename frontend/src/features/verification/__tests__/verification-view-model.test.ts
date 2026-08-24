import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  ageFromDate,
  emptyApplication,
  emptyAddress,
  emptyGuardian,
  formatBytes,
  masked,
  useVerificationViewModel,
} from "@/features/verification";
import { getVerificationService } from "@/services/verification/verification-service.factory";

vi.mock("@/services/verification/verification-service.factory", () => ({
  getVerificationService: vi.fn(),
  resetVerificationService: vi.fn(),
}));

function createMockService() {
  return {
    getStatus: vi.fn().mockResolvedValue({
      success: true,
      data: {
        status: "draft",
        adultAge: 18,
        minimumAge: 13,
        requiredDocuments: ["user_government_id"],
        documents: [],
        application: null,
        canReview: false,
      },
    }),
    saveApplication: vi.fn(),
    uploadDocument: vi.fn(),
    submit: vi.fn(),
  };
}

describe("verification utilities and view model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("formats helper values", () => {
    expect(emptyAddress.countryCode).toBe("PH");
    expect(emptyGuardian.address.countryCode).toBe("PH");
    expect(emptyApplication.privacyNoticeAccepted).toBe(true);
    expect(ageFromDate("2000-01-01")).not.toBeNull();
    expect(masked("123456789")).toContain("6789");
    expect(formatBytes(2048)).toBe("2 KB");
  });

  it("loads verification state and supports step changes", async () => {
    const mockService = createMockService();
    vi.mocked(getVerificationService).mockReturnValue(mockService as ReturnType<typeof createMockService>);

    const { result } = renderHook(() => useVerificationViewModel());

    expect(result.current.loading).toBe(true);
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.snapshot?.status).toBe("draft");

    act(() => {
      result.current.setStep(1);
    });

    expect(result.current.step).toBe(1);
  });
});

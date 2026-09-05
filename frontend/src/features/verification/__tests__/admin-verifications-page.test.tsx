import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminPage from "@/app/(protected)/admin/verifications/page";
import {
  verificationApi,
  type AdminVerificationDetail,
  type AdminVerificationSummary,
} from "@/services/verification/verification-api";
import { AppError } from "@/shared/errors/app-error";

vi.mock("@/shared/components/layout/echo-shells", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/services/verification/verification-api", () => ({
  verificationApi: { adminList: vi.fn(), adminDetail: vi.fn(), adminClaim: vi.fn(), adminDecide: vi.fn() },
}));
const summary: AdminVerificationSummary = {
  id: "application-one",
  userId: "applicant-one",
  status: "submitted",
  isMinor: false,
  ageAtSubmission: 25,
  submittedAt: "2026-08-31T00:00:00Z",
  reviewedAt: null,
  updatedAt: "2026-08-31T00:00:00Z",
};
const detail: AdminVerificationDetail = {
  ...summary,
  reasonCode: null,
  reviewNote: null,
  application: {
    legalName: "Sample Applicant",
    dateOfBirth: "2001-01-01",
    phoneNumber: "000000000",
    governmentIdType: "Passport",
    governmentIdNumber: "SYNTHETIC-ONLY",
    address: {
      line1: "Sample address",
      line2: null,
      city: "Sample city",
      province: "Sample",
      postalCode: "0000",
      countryCode: "PH",
    },
    guardian: null,
    privacyNoticeAccepted: true,
    identityVerificationConsent: true,
    guardianConsent: false,
  },
  documents: [
    {
      id: "doc",
      kind: "user_government_id",
      mimeType: "image/png",
      sizeBytes: 100,
      uploadedAt: "2026-08-31",
      signedUrl: "https://example.invalid/protected-document",
    },
  ],
};
beforeEach(() => {
  vi.mocked(verificationApi.adminList).mockResolvedValue([summary]);
  vi.mocked(verificationApi.adminDetail).mockResolvedValue(detail);
  vi.mocked(verificationApi.adminClaim).mockResolvedValue({ ...detail, status: "under_review" });
  vi.mocked(verificationApi.adminDecide).mockResolvedValue({ ...detail, status: "approved" });
});
async function openReview() {
  fireEvent.click(await screen.findByRole("button", { name: /Applicant applican/ }));
  await screen.findByRole("heading", { name: "Sample Applicant" });
  fireEvent.click(screen.getByRole("button", { name: /Start review/ }));
  await screen.findByRole("button", { name: "Review decision" });
}
describe("Admin verification workspace", () => {
  it("does not fetch sensitive details until an application is selected", async () => {
    render(<AdminPage />);
    await screen.findByRole("button", { name: /Applicant applican/ });
    expect(verificationApi.adminDetail).not.toHaveBeenCalled();
    expect(screen.getByText("Select an application to begin.")).toBeVisible();
  });
  it("requires evidence acknowledgement and explicit confirmation before approval", async () => {
    render(<AdminPage />);
    await openReview();
    const review = screen.getByRole("button", { name: "Review decision" });
    expect(review).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /I reviewed the identity/ }));
    fireEvent.click(review);
    expect(verificationApi.adminDecide).not.toHaveBeenCalled();
    expect(screen.getByText(/Confirm approved for Sample Applicant/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Confirm decision" }));
    await waitFor(() =>
      expect(verificationApi.adminDecide).toHaveBeenCalledWith("application-one", {
        decision: "approved",
        reasonCode: null,
        note: null,
      }),
    );
    expect(await screen.findByText("Decision saved: approved.")).toBeVisible();
  });
  it("requires a reason and helpful note for rejection", async () => {
    render(<AdminPage />);
    await openReview();
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /I reviewed the identity/ }));
    expect(screen.getByRole("button", { name: "Review decision" })).toBeDisabled();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "document_unclear" } });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Please submit a clearer image." } });
    fireEvent.click(screen.getByRole("button", { name: "Review decision" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm decision" }));
    await waitFor(() =>
      expect(verificationApi.adminDecide).toHaveBeenCalledWith(
        "application-one",
        expect.objectContaining({ decision: "rejected", reasonCode: "document_unclear" }),
      ),
    );
  });
  it("shows an access-denied screen without application details", async () => {
    vi.mocked(verificationApi.adminList).mockRejectedValue(
      new AppError({ code: "AUTHORIZATION_ERROR", userMessage: "Restricted", statusCode: 403 }),
    );
    render(<AdminPage />);
    expect(await screen.findByRole("heading", { name: "Administrator access required" })).toBeVisible();
    expect(verificationApi.adminDetail).not.toHaveBeenCalled();
  });
  it("ignores a delayed response after the user changes filters", async () => {
    let resolve!: (value: AdminVerificationDetail) => void;
    vi.mocked(verificationApi.adminDetail).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    render(<AdminPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Applicant applican/ }));
    fireEvent.click(screen.getByRole("button", { name: "Approved" }));
    await act(async () => {
      resolve(detail);
    });
    expect(screen.queryByRole("heading", { name: "Sample Applicant" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review decision" })).not.toBeInTheDocument();
  });
  it("shows decision failures without claiming success", async () => {
    vi.mocked(verificationApi.adminDecide).mockRejectedValue(new Error("offline"));
    render(<AdminPage />);
    await openReview();
    fireEvent.click(screen.getByRole("checkbox", { name: /I reviewed the identity/ }));
    fireEvent.click(screen.getByRole("button", { name: "Review decision" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm decision" }));
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(screen.queryByText("Decision saved: approved.")).not.toBeInTheDocument();
  });
});

import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EncryptionService } from "../../../infrastructure/encryption/encryption.service.js";
import type { DocumentScanner } from "../../../infrastructure/security/document-scanner.js";
import { VerificationService } from "../verification.service.js";

function harness(admin: boolean, row: Record<string, unknown> | null = null, documents: Record<string, unknown>[] = [], scanner?: DocumentScanner) {
  let table = "";
  const download = vi.fn();
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn(async () => ({ error: null })),
    maybeSingle: vi.fn(async () => ({
      data: table === "verification_admins" ? (admin ? { user_id: "reviewer" } : null) : row,
      error: null,
    })),
    order: vi.fn(async () => ({ data: documents, error: null })),
  };
  const db = {
    storage: { from: vi.fn(() => ({ download })) },
    schema: vi.fn().mockReturnThis(),
    from: vi.fn((name) => {
      table = name;
      return chain;
    }),
  };
  return {
    service: new VerificationService(
      db as unknown as SupabaseClient,
      { encrypt: vi.fn(), decrypt: vi.fn() } as EncryptionService,
      scanner,
    ),
    chain,
    db,
    download,
  };
}
describe("Verification administrator authorization", () => {
  it.each(["list", "detail", "claim", "decision"])(
    "rejects a non-admin before %s data is accessed",
    async (operation) => {
      const { service, db } = harness(false);
      const call =
        operation === "list"
          ? service.listForAdmin("ordinary")
          : operation === "detail"
            ? service.getForAdmin("ordinary", "application")
            : operation === "claim"
              ? service.claimForReview("ordinary", "application")
              : service.decide("ordinary", "application", { decision: "approved", reasonCode: null, note: null });
      await expect(call).rejects.toMatchObject({ statusCode: 403 });
      expect(db.from.mock.calls.map(([name]) => name)).toEqual(["verification_admins"]);
      expect(db.schema).toHaveBeenCalledWith("verification_service");
    },
  );
  it("prevents an administrator deciding their own application", async () => {
    const { service, chain } = harness(true, { user_id: "reviewer", verification_status: "under_review" });
    await expect(
      service.decide("reviewer", "application", { decision: "approved", reasonCode: null, note: null }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(chain.update).not.toHaveBeenCalled();
  });
  it.each(["submitted", "approved", "rejected"])("rejects a decision in %s state", async (state) => {
    const { service, chain } = harness(true, { user_id: "applicant", verification_status: state });
    await expect(
      service.decide("reviewer", "application", { decision: "approved", reasonCode: null, note: null }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(chain.update).not.toHaveBeenCalled();
  });
  it("does not approve an application without required evidence", async () => {
    const { service, chain } = harness(true, {
      user_id: "applicant",
      verification_status: "under_review",
      is_minor: false,
    });
    await expect(
      service.decide("reviewer", "application", { decision: "approved", reasonCode: null, note: null }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(chain.update).not.toHaveBeenCalled();
  });
  it("does not submit documents that the scanner has not cleared", async () => {
    const { service, chain } = harness(true, {
      id: "application",
      verification_status: "draft",
      details_ciphertext: "encrypted",
      is_minor: false,
    }, [{ document_kind: "user_government_id", scan_status: "quarantined" }]);
    await expect(service.submit("applicant")).rejects.toMatchObject({ code: "DOCUMENT_SCAN_PENDING" });
    expect(chain.update).not.toHaveBeenCalled();
  });
  it("rescans a draft after scanner recovery before submitting it", async () => {
    const bytes = Buffer.from("%PDF-1.7\n synthetic fixture\n%%EOF");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const documents: Record<string, unknown>[] = [{ id: "document", document_kind: "user_government_id", mime_type: "application/pdf", storage_path: "applicant/document.pdf", sha256_hex: sha256, scan_status: "quarantined" }];
    const scanner: DocumentScanner = { inspect: vi.fn(async () => ({ status: "clean", sha256, scannerVersion: "test-scanner", pages: 1 })) };
    const { service, chain, download } = harness(false, {
      id: "application", verification_status: "draft", details_ciphertext: "encrypted", is_minor: false,
    }, documents, scanner);
    download.mockResolvedValue({ data: new Blob([new Uint8Array(bytes)]), error: null });
    chain.update.mockImplementation((patch) => {
      if ("scan_status" in patch) Object.assign(documents[0], patch);
      return chain;
    });
    vi.spyOn(service, "getStatus").mockResolvedValue({} as never);

    await service.submit("applicant");
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ scan_status: "clean" }));
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ verification_status: "submitted" }));
  });
  it("does not claim a quarantined application", async () => {
    const { service, chain } = harness(true);
    vi.spyOn(service, "getForAdmin").mockRejectedValue(new Error("Document security checks must finish before review."));
    await expect(service.claimForReview("reviewer", "application")).rejects.toThrow("Document security checks");
    expect(chain.update).not.toHaveBeenCalled();
  });
  it("rescans a stored document only after checking its hash and reviewer authority", async () => {
    const bytes = Buffer.from("%PDF-1.7\n synthetic fixture\n%%EOF");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const scanner: DocumentScanner = { inspect: vi.fn(async () => ({ status: "clean", sha256, scannerVersion: "test-scanner", pages: 1 })) };
    const { service, chain, download } = harness(true, {
      user_id: "applicant", verification_status: "submitted",
    }, [{ id: "document", document_kind: "user_government_id", mime_type: "application/pdf", storage_path: "applicant/document.pdf", sha256_hex: sha256, scan_status: "quarantined" }], scanner);
    download.mockResolvedValue({ data: new Blob([new Uint8Array(bytes)]), error: null });
    vi.spyOn(service, "getForAdmin").mockResolvedValue({} as never);

    await service.rescanForAdmin("reviewer", "application");
    expect(download).toHaveBeenCalledWith("applicant/document.pdf");
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ scan_status: "clean", scanner_version: "test-scanner" }));
  });
  it("never marks altered stored bytes clean", async () => {
    const scanner: DocumentScanner = { inspect: vi.fn() };
    const { service, chain, download } = harness(true, {
      user_id: "applicant", verification_status: "submitted",
    }, [{ id: "document", mime_type: "application/pdf", storage_path: "applicant/document.pdf", sha256_hex: "wrong", scan_status: "quarantined" }], scanner);
    download.mockResolvedValue({ data: new Blob(["altered"]), error: null });
    await expect(service.rescanForAdmin("reviewer", "application")).rejects.toMatchObject({ code: "DOCUMENT_INTEGRITY_FAILED" });
    expect(scanner.inspect).not.toHaveBeenCalled();
    expect(chain.update).not.toHaveBeenCalled();
  });
  it("links a verification decision notification to the user's verification settings", async () => {
    const { service, chain } = harness(true, {
      id: "application",
      user_id: "applicant",
      verification_status: "under_review",
    });
    vi.spyOn(service, "getForAdmin").mockResolvedValue({} as never);

    await service.decide("reviewer", "application", {
      decision: "rejected",
      reasonCode: "unclear_document",
      note: "Please resubmit a clearer document.",
    });

    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "applicant",
      notification_type: "verification_status",
      resource_type: "identity_verification",
      resource_id: "application",
    }));
  });
});

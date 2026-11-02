import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EncryptionService } from "../../../infrastructure/encryption/encryption.service.js";
import type { DocumentScanner } from "../../../infrastructure/security/document-scanner.js";
import { VerificationService } from "../verification.service.js";

function harness(admin: boolean, row: Record<string, unknown> | null = null, documents: Record<string, unknown>[] = [], scanner?: DocumentScanner) {
  let table = "";
  const download = vi.fn();
  const createSignedUrl = vi.fn(async () => ({ data: { signedUrl: "https://example.invalid/evidence" }, error: null }));
  const encryption = { encrypt: vi.fn(), decrypt: vi.fn() };
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
    storage: { from: vi.fn(() => ({ download, createSignedUrl })) },
    schema: vi.fn().mockReturnThis(),
    from: vi.fn((name) => {
      table = name;
      return chain;
    }),
  };
  return {
    service: new VerificationService(
      db as unknown as SupabaseClient,
      encryption as unknown as EncryptionService,
      scanner,
    ),
    chain,
    db,
    download,
    createSignedUrl,
    encryption,
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
  it("submits an application with all required documents even while scanning is pending", async () => {
    const { service, chain } = harness(false, {
      id: "application",
      verification_status: "draft",
      details_ciphertext: "encrypted",
      is_minor: false,
    }, [{ document_kind: "user_government_id", scan_status: "quarantined" }]);
    vi.spyOn(service, "getStatus").mockResolvedValue({} as never);
    await service.submit("applicant");
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ verification_status: "submitted" }));
  });
  it("keeps unscanned evidence closed while allowing an authorized reviewer to see the application", async () => {
    const { service, db } = harness(true, {
      id: "application", user_id: "applicant", verification_status: "submitted",
    }, [{ id: "document", document_kind: "user_government_id", scan_status: "quarantined" }]);
    const result = await service.getForAdmin("reviewer", "application");
    expect(result.documents).toEqual([expect.objectContaining({ scanStatus: "quarantined", signedUrl: null })]);
    expect(db.storage.from).not.toHaveBeenCalled();
  });
  it("allows the reviewer to claim a submitted application with pending scans", async () => {
    const row = { id: "application", user_id: "applicant", verification_status: "submitted" };
    const { service, chain } = harness(true, row, [
      { id: "document", document_kind: "user_government_id", scan_status: "quarantined" },
    ]);
    chain.update.mockImplementation((patch) => { Object.assign(row, patch); return chain; });
    await service.claimForReview("reviewer", "application");
    expect(chain.update).toHaveBeenCalledWith({ verification_status: "under_review" });
  });
  it("still refuses approval of an unscanned document", async () => {
    const { service, chain } = harness(true, {
      id: "application", user_id: "applicant", verification_status: "under_review", is_minor: false,
    }, [{ id: "document", document_kind: "user_government_id", scan_status: "quarantined" }]);
    await expect(service.decide("reviewer", "application", {
      decision: "approved", reasonCode: null, note: null,
    })).rejects.toMatchObject({ code: "DOCUMENT_SCAN_PENDING" });
    expect(chain.update).not.toHaveBeenCalled();
  });
  it("approves a claimed application only after required evidence is clean", async () => {
    const row = {
      id: "application", user_id: "applicant", verification_status: "under_review", is_minor: false,
      details_ciphertext: "AQ==", details_iv: "AQ==", details_auth_tag: "AQ==", details_key_version: 1,
    };
    const { service, chain, createSignedUrl, encryption } = harness(true, row, [{
      id: "document", document_kind: "user_government_id", scan_status: "clean",
      scanned_at: "2026-10-31T00:00:00Z", scanner_version: "test-scanner", storage_path: "applicant/document.pdf",
    }]);
    encryption.decrypt.mockReturnValue(JSON.stringify({ legalName: "Sample Applicant" }));
    chain.update.mockImplementation((patch) => { Object.assign(row, patch); return chain; });
    const result = await service.decide("reviewer", "application", {
      decision: "approved", reasonCode: null, note: null,
    });
    expect(result.status).toBe("approved");
    expect(createSignedUrl).toHaveBeenCalledWith("applicant/document.pdf", 300);
  });
  it("allows the reviewer to request a replacement for an unscanned document", async () => {
    const { service, chain } = harness(true, {
      id: "application", user_id: "applicant", verification_status: "under_review", is_minor: false,
    }, [{ id: "document", document_kind: "user_government_id", scan_status: "quarantined" }]);
    await service.decide("reviewer", "application", {
      decision: "needs_changes", reasonCode: "document_scan_pending", note: "Please replace the document.",
    });
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ verification_status: "needs_changes" }));
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

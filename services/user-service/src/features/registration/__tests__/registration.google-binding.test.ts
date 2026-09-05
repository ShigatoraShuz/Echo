import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { RegistrationService } from "../registration.service.js";

describe("Google signup identity binding", () => {
  it.each(["password_account_requires_link", "existing_google_identity", "no_existing_account"])("handles %s without implicit account linking", async (status) => {
    const hash = (value: string) => createHmac("sha256", "secret").update(value).digest("hex");
    const rpc = vi.fn(async (name: string) => ({ data: name === "echo_registration_get_draft"
      ? [{ id: "draft", state: "account", csrf_hash: hash("csrf"), google_nonce_hash: hash("nonce") }]
      : name === "echo_google_identity_status" ? [{ status }] : true, error: null }));
    const service = new RegistrationService({ rpc } as any, {} as any, "secret", "google-id", "http://localhost:3000");
    vi.spyOn(service, "verifyGoogleToken").mockResolvedValue({ sub: "verified-subject", email: "user@example.com" });
    const result = service.bindGoogleSignup("token", "csrf", "signed-token", "nonce");
    if (status === "no_existing_account") {
      await expect(result).resolves.toMatchObject({ identity: { sub: "verified-subject" } });
      expect(rpc.mock.calls.some(([name]) => name === "echo_registration_update_draft")).toBe(true);
    } else {
      await expect(result).rejects.toMatchObject({ code: "ACCOUNT_EXISTS" });
      expect(rpc.mock.calls.some(([name]) => name === "echo_registration_update_draft")).toBe(false);
    }
  });
});

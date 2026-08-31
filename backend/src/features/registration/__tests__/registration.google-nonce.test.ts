import { createHash } from "node:crypto";
import { LoginTicket, OAuth2Client } from "google-auth-library";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { RegistrationService } from "../registration.service.js";

function harness(tokenNonce: string, verified = true) {
  const verify = vi.spyOn(OAuth2Client.prototype, "verifyIdToken").mockResolvedValue(
    new LoginTicket(undefined, {
      iss: "https://accounts.google.com",
      aud: "test-google-client",
      sub: "subject",
      email: "USER@example.com",
      email_verified: verified,
      iat: 1,
      exp: 9999999999,
      nonce: tokenNonce,
    }),
  );
  const rpc = vi.fn().mockResolvedValue({ data: [{ status: "existing_google_identity" }], error: null });
  const db = { rpc } as unknown as SupabaseClient;
  const service = new RegistrationService(db, db, "test-signup-secret", "test-google-client", "http://localhost:3000");
  return { service, verify, rpc };
}

describe("Google signed nonce verification", () => {
  const raw = "server-issued-random-challenge";
  const hashed = createHash("sha256").update(raw).digest("hex");

  it("accepts the signed hash of the raw challenge, and validates the Google audience", async () => {
    const { service, verify, rpc } = harness(hashed);
    await expect(service.googleLoginStatus("signed-google-token", raw)).resolves.toMatchObject({
      status: "existing_google_identity",
    });
    expect(verify).toHaveBeenCalledWith({ idToken: "signed-google-token", audience: "test-google-client" });
    expect(rpc).toHaveBeenCalledWith("echo_google_identity_status", {
      google_subject: "subject",
      verified_email: "user@example.com",
    });
  });

  it.each([raw, "wrong-nonce", ""])("rejects incorrect nonce claims before database access: %s", async (tokenNonce) => {
    const { service, rpc } = harness(tokenNonce);
    await expect(service.googleLoginStatus("signed-google-token", raw)).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("still rejects an unverified email even with the right nonce", async () => {
    const { service, rpc } = harness(hashed, false);
    await expect(service.googleLoginStatus("signed-google-token", raw)).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
});

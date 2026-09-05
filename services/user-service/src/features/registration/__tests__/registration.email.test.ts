import type { SupabaseClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { RegistrationService } from "../registration.service.js";

const secret = "test-registration-hmac-secret";
const hash = (value: string) => createHmac("sha256", secret).update(value).digest("hex");
const draft = {
  id: "00000000-0000-4000-8000-000000000010",
  token_hash: hash("draft-token"),
  csrf_hash: hash("csrf-token"),
  state: "account",
};

function harness(signUpError: { message: string } | null) {
  const rpc = vi.fn()
    .mockResolvedValueOnce({ data: [draft], error: null })
    .mockResolvedValue({ data: true, error: null });
  const signUp = vi.fn().mockResolvedValue({ data: {}, error: signUpError });
  const service = new RegistrationService(
    { rpc } as never,
    { auth: { signUp } } as unknown as SupabaseClient,
    secret,
    "",
    "http://localhost:3000",
  );
  return { service, rpc, signUp };
}

describe("email registration draft lifecycle", () => {
  it("reserves before Supabase signup and rotates the surviving verification draft", async () => {
    const { service, rpc, signUp } = harness(null);

    const result = await service.registerEmail("draft-token", "csrf-token", " Person@Example.COM ", "SecurePass1");

    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: "person@example.com",
      options: expect.objectContaining({ emailRedirectTo: "http://localhost:3000/callback?next=/onboarding" }),
    }));
    expect(rpc).toHaveBeenCalledTimes(3);
    expect(rpc.mock.calls[1]?.[1]).toMatchObject({ expected_state: "account", changes: { state: "verification_pending" } });
    expect(rpc.mock.calls[2]?.[1]).toMatchObject({ expected_state: "verification_pending", changes: { state: "verification_pending" } });
    expect(result.token).toBeTruthy();
    expect(result.csrf).toBeTruthy();
  });

  it("reopens the account step when Supabase rejects signup", async () => {
    const { service, rpc } = harness({ message: "Email already registered" });

    await expect(service.registerEmail("draft-token", "csrf-token", "person@example.com", "SecurePass1"))
      .rejects.toMatchObject({ code: "EMAIL_SIGNUP_FAILED" });

    expect(rpc.mock.calls[2]?.[1]).toMatchObject({
      expected_state: "verification_pending",
      changes: { state: "account", email: null, reservation_id: null, verification_sent_at: null },
    });
  });
});

import { describe, expect, it, vi } from "vitest";
import { provisionVerificationAdmin } from "../scripts/lib/verification-admin.mjs";

function harness(confirmed = true, existing = true) {
  let active: boolean | undefined;
  const table = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({
      data: active === undefined ? null : { user_id: "owner", is_active: active },
      error: null,
    })),
    upsert: vi.fn(async (row: { is_active: boolean }) => {
      active = row.is_active;
      return { error: null };
    }),
  };
  const client = {
    schema: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnValue(table),
    auth: {
      admin: {
        listUsers: vi.fn(async () => ({
          data: {
            users: existing
              ? [{ id: "owner", email: "owner@example.com", email_confirmed_at: confirmed ? "2026-08-31" : null }]
              : [],
          },
          error: null,
        })),
      },
    },
  };
  return { client, table };
}
describe("Administrator bootstrap", () => {
  it("defaults to read-only and targets the canonical private schema", async () => {
    const { client, table } = harness();
    expect(await provisionVerificationAdmin(client, " OWNER@example.com ")).toMatchObject({
      active: false,
      changed: false,
    });
    expect(client.schema).toHaveBeenCalledWith("verification_service");
    expect(table.upsert).not.toHaveBeenCalled();
  });
  it("grants idempotently, verifies the role and supports revocation", async () => {
    const { client, table } = harness();
    expect(await provisionVerificationAdmin(client, "owner@example.com", "grant")).toMatchObject({
      active: true,
      changed: true,
    });
    expect(await provisionVerificationAdmin(client, "owner@example.com", "grant")).toMatchObject({
      active: true,
      changed: false,
    });
    expect(table.upsert).toHaveBeenCalledTimes(1);
    expect(table.upsert).toHaveBeenCalledWith({ user_id: "owner", is_active: true }, { onConflict: "user_id" });
    expect(await provisionVerificationAdmin(client, "owner@example.com", "revoke")).toMatchObject({
      active: false,
      changed: true,
    });
  });
  it("does not grant an unverified identity", async () => {
    const { client, table } = harness(false);
    await expect(provisionVerificationAdmin(client, "owner@example.com", "grant")).rejects.toThrow(
      "Verify this account's email",
    );
    expect(table.upsert).not.toHaveBeenCalled();
  });
  it("does not invent an account or shared password", async () => {
    const { client, table } = harness(true, false);
    await expect(provisionVerificationAdmin(client, "owner@example.com", "grant")).rejects.toThrow("No ECHO account");
    expect(table.upsert).not.toHaveBeenCalled();
  });
});

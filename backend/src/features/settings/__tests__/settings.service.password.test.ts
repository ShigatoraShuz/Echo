import { describe, expect, it, vi } from "vitest";
import { SettingsService } from "../settings.service.js";

function createDatabase() {
  const auditInsert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn(() => ({ insert: auditInsert }));
  const schema = vi.fn(() => ({ from }));
  const signInWithPassword = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  const updateUserById = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  return {
    database: {
      auth: {
        signInWithPassword,
        admin: { updateUserById },
      },
      schema,
    },
    auditInsert,
    signInWithPassword,
    updateUserById,
  };
}

describe("SettingsService password changes", () => {
  it("verifies the current password before updating the Supabase Auth password", async () => {
    const mocks = createDatabase();
    const service = new SettingsService(mocks.database as never);

    const result = await service.changePassword("user-1", "mira@example.com", {
      currentPassword: "OldPassword1!",
      newPassword: "NewPassword1!",
    });

    expect(result).toEqual({ passwordChanged: true });
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "mira@example.com",
      password: "OldPassword1!",
    });
    expect(mocks.updateUserById).toHaveBeenCalledWith("user-1", {
      password: "NewPassword1!",
    });
    expect(mocks.auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      event_type: "security.password_changed",
      user_id: "user-1",
    }));
  });

  it("rejects an incorrect current password without updating the user", async () => {
    const mocks = createDatabase();
    mocks.signInWithPassword.mockResolvedValue({ data: { user: null }, error: { message: "invalid login credentials" } });
    const service = new SettingsService(mocks.database as never);

    await expect(service.changePassword("user-1", "mira@example.com", {
      currentPassword: "wrong",
      newPassword: "NewPassword1!",
    })).rejects.toMatchObject({
      code: "INVALID_CURRENT_PASSWORD",
      statusCode: 401,
    });

    expect(mocks.updateUserById).not.toHaveBeenCalled();
    expect(mocks.auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      event_type: "security.password_change_failed",
    }));
  });
});

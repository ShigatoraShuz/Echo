import { describe, expect, it, vi } from "vitest";
import { SettingsService } from "../settings.service.js";

const userId = "40000000-0000-4000-8000-000000000001";

function legacyDatabase() {
  const updates: Array<Record<string, unknown>> = [];
  const privacy = {
    facial_analysis_enabled: false,
    journal_ai_analysis_enabled: false,
    crisis_support_visible: true,
    lock_screen_private: true,
  };
  const rows: Record<string, unknown> = {
    profiles: { display_name: "Lloyd", timezone: "Asia/Manila" },
    notification_preferences: {},
    privacy_preferences: privacy,
    trusted_contacts: [],
    data_export_requests: [],
    account_deletion_requests: null,
  };
  const from = vi.fn((table: string) => {
    let updating = false;
    let updateError: { code: string; message: string } | null = null;
    const query = {
      upsert: vi.fn(async () => ({ error: null })),
      select: vi.fn(() => query),
      order: vi.fn(() => query),
      limit: vi.fn(() => query),
      update: vi.fn((values: Record<string, unknown>) => {
        updating = true;
        updates.push(values);
        updateError = Object.hasOwn(values, "buddy_history_enabled")
          ? { code: "PGRST204", message: "Could not find buddy_history_enabled in the schema cache" }
          : null;
        return query;
      }),
      eq: vi.fn(() => updating ? Promise.resolve({ error: updateError }) : query),
      in: vi.fn(() => query),
      maybeSingle: vi.fn(async () => ({ data: rows[table] ?? null, error: null })),
      then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
        Promise.resolve({ data: rows[table] ?? [], error: null }).then(resolve),
      insert: vi.fn(async () => ({ error: null })),
    };
    return query;
  });
  return { database: { schema: vi.fn(() => ({ from })) }, from, updates };
}

describe("SettingsService with an older Buddy schema", () => {
  it("loads other settings and marks Buddy history controls unavailable", async () => {
    const mocks = legacyDatabase();
    const service = new SettingsService(mocks.database as never);
    const snapshot = await service.get(userId);
    expect(snapshot.profile.displayName).toBe("Lloyd");
    expect(snapshot.privacy).toMatchObject({ buddyHistoryEnabled: true, buddyHistoryAvailable: false });
    expect(mocks.from).toHaveBeenCalledWith("privacy_preferences");
  });

  it("saves unrelated privacy settings without silently disabling Buddy history", async () => {
    const mocks = legacyDatabase();
    const service = new SettingsService(mocks.database as never);
    await service.updatePrivacy(userId, {
      buddyHistoryEnabled: true, facialAnalysisEnabled: false,
      crisisSupportVisible: true, lockScreenPrivate: true,
    });
    expect(mocks.updates).toHaveLength(2);
    expect(mocks.updates[1]).not.toHaveProperty("buddy_history_enabled");
  });

  it("rejects a history-off choice that the old database cannot enforce", async () => {
    const mocks = legacyDatabase();
    const service = new SettingsService(mocks.database as never);
    await expect(service.updatePrivacy(userId, {
      buddyHistoryEnabled: false, facialAnalysisEnabled: false,
      crisisSupportVisible: true, lockScreenPrivate: true,
    })).rejects.toMatchObject({ code: "BUDDY_HISTORY_UNAVAILABLE" });
    expect(mocks.updates).toHaveLength(1);
  });
});

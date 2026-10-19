import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { OnboardingService } from "../onboarding.service.js";

describe("onboarding setup preferences", () => {
  it.each([true, false])("uses the notification choice for available in-app analysis updates (%s)", async (enabled) => {
    const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
    const table = { upsert: vi.fn().mockResolvedValue({ error: null }), update };
    const database = { schema: vi.fn(() => ({ from: vi.fn(() => table) })) } as unknown as SupabaseClient;

    await new OnboardingService(database).saveSetup("user-1", { notifications: enabled });

    expect(update).toHaveBeenCalledWith({
      in_app_enabled: enabled,
      insight_notifications_enabled: enabled,
    });
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ push_enabled: enabled }));
  });

  it("saves camera consent without clearing identity choices", async () => {
    const updates: Array<{ table: string; value: Record<string, unknown> }> = [];
    const database = {
      schema: vi.fn(() => ({
        from: vi.fn((table: string) => ({
          upsert: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn((value: Record<string, unknown>) => {
            updates.push({ table, value });
            return { eq: vi.fn().mockResolvedValue({ error: null }) };
          }),
        })),
      })),
    } as unknown as SupabaseClient;

    await new OnboardingService(database).saveSetup("user-1", { facialAnalysis: true });

    expect(updates.find((entry) => entry.table === "profiles")?.value).toEqual({ onboarding_step: 2 });
    expect(updates.find((entry) => entry.table === "privacy_preferences")?.value).toEqual({
      facial_analysis_enabled: true,
    });
  });
});

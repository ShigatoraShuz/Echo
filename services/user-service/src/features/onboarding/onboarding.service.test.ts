import { describe, expect, it } from "vitest";
import { OnboardingService } from "./onboarding.service.js";

type Event = { table: string; operation: string; args: unknown[] };

function databaseDouble(events: Event[], readError = false) {
  const rows: Record<string, Record<string, unknown>> = {
    profiles: { onboarding_completed: false },
    notification_preferences: {},
  };
  return {
    from(table: string) {
      const query: any = {
        upsert(...args: unknown[]) { events.push({ table, operation: "upsert", args }); return query; },
        update(...args: unknown[]) { events.push({ table, operation: "update", args }); Object.assign(rows[table] ??= {}, args[0]); return query; },
        select(...args: unknown[]) { events.push({ table, operation: "select", args }); return query; },
        eq(...args: unknown[]) { events.push({ table, operation: "eq", args }); return query; },
        single() {
          return Promise.resolve({
            data: rows[table] ?? null,
            error: readError ? { message: "unavailable" } : null,
          });
        },
        then(resolve: (value: unknown) => unknown) {
          const data = table === "user_consents" ? [{ consent_type: "terms_of_use", accepted: true }] : [];
          return Promise.resolve(resolve({ data, error: null }));
        },
      };
      return query;
    },
  };
}

describe("OnboardingService canonical profile identity", () => {
  it("creates, updates, completes, and reads profiles by profiles.id", async () => {
    const events: Event[] = [];
    const service = new OnboardingService(databaseDouble(events) as any);
    const userId = "00000000-0000-4000-8000-000000000031";

    await service.saveProfile(userId, { displayName: "Mira", timezone: "Asia/Manila" });
    await service.completeOnboarding(userId);
    await expect(service.getStatus(userId)).resolves.toMatchObject({ onboardingCompleted: true, displayName: "Mira" });

    const profileEvents = events.filter((event) => event.table === "profiles");
    expect(profileEvents.filter((event) => event.operation === "upsert").every((event) => (event.args[0] as any).id === userId)).toBe(true);
    expect(profileEvents.filter((event) => event.operation === "eq").map((event) => event.args)).toEqual([
      ["id", userId],
      ["id", userId],
      ["id", userId],
    ]);
    expect(JSON.stringify(profileEvents)).not.toContain("user_id");
  });

  it("persists and retrieves every onboarding preference collected by the UI", async () => {
    const events: Event[] = [];
    const service = new OnboardingService(databaseDouble(events) as any);
    const userId = "00000000-0000-4000-8000-000000000041";
    await service.saveProfile(userId, {
      displayName: "Mira",
      preferredName: "Mi",
      timezone: "Asia/Taipei",
      goals: ["daily_reflection", "stress_support"],
      buddyTone: "reflective",
      preferredCheckInTime: "20:30",
      startingMood: "calm",
    });

    const profileUpdate = events.find((event) => event.table === "profiles" && event.operation === "update");
    expect(profileUpdate?.args[0]).toMatchObject({
      display_name: "Mira",
      preferred_name: "Mi",
      goals: ["daily_reflection", "stress_support"],
      buddy_tone_preference: "reflective",
      starting_mood_preference: "calm",
      onboarding_step: 1,
    });
    const reminderUpdate = events.find((event) => event.table === "notification_preferences" && event.operation === "update");
    expect(reminderUpdate?.args[0]).toMatchObject({ reminder_time: "20:30", reminder_timezone: "Asia/Taipei" });
    await service.saveSetup(userId, { notifications: true, theme: "dark", pronouns: "she/her" });
    await service.completeOnboarding(userId);
    await expect(service.getStatus(userId)).resolves.toMatchObject({
      displayName: "Mira", preferredName: "Mi", timezone: "Asia/Taipei",
      goals: ["daily_reflection", "stress_support"], buddyTone: "reflective",
      preferredCheckInTime: "20:30", startingMood: "calm", pronouns: "she/her",
      onboardingCompleted: true, onboardingStep: 3,
    });
  });

  it("does not replace failed preference reads with plausible defaults", async () => {
    const service = new OnboardingService(databaseDouble([], true) as any);
    await expect(service.getStatus("user-1")).rejects.toThrow("could not be retrieved");
  });
});

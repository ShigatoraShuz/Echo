import { describe, expect, it } from "vitest";
import { OnboardingService } from "./onboarding.service.js";

type Event = { table: string; operation: string; args: unknown[] };

function databaseDouble(events: Event[]) {
  return {
    from(table: string) {
      const query: any = {
        upsert(...args: unknown[]) { events.push({ table, operation: "upsert", args }); return query; },
        update(...args: unknown[]) { events.push({ table, operation: "update", args }); return query; },
        select(...args: unknown[]) { events.push({ table, operation: "select", args }); return query; },
        eq(...args: unknown[]) { events.push({ table, operation: "eq", args }); return query; },
        single() {
          return Promise.resolve({
            data: table === "profiles" ? { onboarding_completed: true, display_name: "Mira", timezone: "Asia/Manila" } : null,
            error: null,
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
});

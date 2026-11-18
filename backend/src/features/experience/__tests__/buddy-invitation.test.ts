import { describe, it, expect } from "vitest";
import { shouldOfferBuddyInvitation } from "../buddy-invitation.js";
const now = Date.parse("2026-11-18T12:00:00Z");
const day = (date: string, emotion = "sadness", model = "same") => ({
  date,
  values: { [emotion]: 0.7, joy: 0.1 },
  modelIdentity: model,
  isSimulated: false,
});
const days = [day("2026-11-18"), day("2026-11-17"), day("2026-11-16")];
describe("Buddy invitation eligibility", () => {
  it("needs three recent analyzed days with repeated strong negative signals", () => {
    expect(shouldOfferBuddyInvitation(days, now)).toBe(true);
    expect(shouldOfferBuddyInvitation(days.slice(0, 2), now)).toBe(false);
  });
  it("does not count several reflections on the same day", () =>
    expect(shouldOfferBuddyInvitation([days[0], days[0], days[0]], now)).toBe(false));
  it("does not combine unrelated models", () =>
    expect(shouldOfferBuddyInvitation([days[0], { ...days[1], modelIdentity: "other" }, days[2]], now)).toBe(false));
  it("ignores simulated, stale and weak signals", () => {
    expect(
      shouldOfferBuddyInvitation(
        days.map((d) => ({ ...d, isSimulated: true })),
        now,
      ),
    ).toBe(false);
    expect(shouldOfferBuddyInvitation(days, now + 10 * 86400000)).toBe(false);
    expect(
      shouldOfferBuddyInvitation(
        days.map((d) => ({ ...d, values: { sadness: 0.15 } })),
        now,
      ),
    ).toBe(false);
  });
  it("does not surface stale negative signals from an older model family", () =>
    expect(
      shouldOfferBuddyInvitation(
        [day("2026-11-15"), day("2026-11-16"), day("2026-11-17"), day("2026-11-18", "joy", "new")],
        now,
      ),
    ).toBe(false));
  it("does not prompt when the latest day has a positive dominant signal", () =>
    expect(shouldOfferBuddyInvitation([day("2026-11-18", "joy"), ...days.slice(1)], now)).toBe(false));
});

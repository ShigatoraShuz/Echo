import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  clearNotificationSound,
  observeNotificationSound,
  quietNow,
  soundEnabled,
  soundActor,
  enableNotificationSound,
} from "./notification-sound";
import type { NotificationSettings } from "@/features/settings/model/settings.model";
const settings = { inAppEnabled: true, reminderTimezone: "UTC" } as NotificationSettings;
const notice = (id: string, minute: number) => ({
  id,
  createdAt: new Date(Date.UTC(2026, 9, 24, 10, minute)).toISOString(),
  readAt: null,
});
const observe = (
  id: string,
  items: ReturnType<typeof notice>[],
  play = vi.fn(),
  policy = settings,
  source = "personal",
) => observeNotificationSound(id, source, items, async () => policy, play);
beforeEach(() => {
  clearNotificationSound();
  localStorage.clear();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
});
afterEach(() => vi.restoreAllMocks());
it("defaults off and never chimes for the initial baseline, old pages or repeated snapshots", async () => {
  const play = vi.fn();
  expect(soundEnabled("a")).toBe(false);
  localStorage.setItem("echo:notification-sounds:a", "true");
  await observe("a", [notice("old", 1)], play);
  await observe("a", [notice("older", 0), notice("old", 1)], play);
  expect(play).not.toHaveBeenCalled();
});
it("plays once for a genuinely new unread update across observers, rerenders and sources", async () => {
  localStorage.setItem("echo:notification-sounds:a", "true");
  const play = vi.fn();
  await observe("a", [notice("old", 1)], play);
  await observe("a", [notice("old", 1)], play, settings, "professional:org");
  await Promise.all([
    observe("a", [notice("new", 2)], play),
    observe("a", [notice("new", 2)], play, settings, "professional:org"),
  ]);
  await observe("a", [notice("new", 2)], play);
  expect(play).toHaveBeenCalledTimes(1);
});
it("respects disabled, muted, quiet-hours and already-read notifications", async () => {
  const play = vi.fn();
  await observe("a", [notice("old", 1)], play);
  await observe("a", [notice("off", 2)], play);
  localStorage.setItem("echo:notification-sounds:a", "true");
  await observe("a", [notice("muted", 3)], play, { ...settings, inAppEnabled: false });
  await observe("a", [notice("quiet", 4)], play, { ...settings, quietHoursStart: "00:00", quietHoursEnd: "00:00" });
  await observeNotificationSound(
    "a",
    "personal",
    [{ ...notice("read", 5), readAt: "read" }],
    async () => settings,
    play,
  );
  expect(play).not.toHaveBeenCalled();
});
it("handles overnight quiet hours in the configured timezone", () => {
  expect(
    quietNow(
      { quietHoursStart: "22:00", quietHoursEnd: "07:00", reminderTimezone: "UTC" },
      new Date("2026-10-24T23:00Z"),
    ),
  ).toBe(true);
  expect(
    quietNow(
      { quietHoursStart: "22:00", quietHoursEnd: "07:00", reminderTimezone: "UTC" },
      new Date("2026-10-24T12:00Z"),
    ),
  ).toBe(false);
});
it("silences a new actor baseline and discards a late settings result after logout", async () => {
  localStorage.setItem("echo:notification-sounds:a", "true");
  await observe("a", [notice("old", 1)]);
  let resolve!: (value: NotificationSettings) => void;
  const policy = new Promise<NotificationSettings>((yes) => (resolve = yes)),
    play = vi.fn();
  const pending = observeNotificationSound("a", "personal", [notice("new", 2)], () => policy, play);
  clearNotificationSound();
  resolve(settings);
  await pending;
  localStorage.setItem("echo:notification-sounds:b", "true");
  await observe("b", [notice("other", 9)], play);
  expect(play).not.toHaveBeenCalled();
  soundActor("a");
  await observe("a", [notice("new", 2)], play);
  expect(play).not.toHaveBeenCalled();
});
it("contains audio and preference failures without rejecting visual delivery", async () => {
  localStorage.setItem("echo:notification-sounds:a", "true");
  await observe("a", [notice("old", 1)]);
  await expect(
    observe("a", [notice("new", 2)], vi.fn().mockRejectedValue(new Error("autoplay"))),
  ).resolves.toBeUndefined();
});

it('requires a gesture to construct audio and contains autoplay rejection, persisting only a preference',async()=>{
 const resume=vi.fn().mockRejectedValue(new Error('autoplay blocked')),close=vi.fn().mockResolvedValue(undefined);const create=vi.fn(function(){return {resume,close,state:'suspended'};});vi.stubGlobal('AudioContext',create);
 try{await observe('a',[notice('old',1)]);await observe('a',[notice('new',2)]);expect(create).not.toHaveBeenCalled();expect(await enableNotificationSound('a',true)).toBe(false);expect(create).toHaveBeenCalledTimes(1);expect(localStorage.getItem('echo:notification-sounds:a')).toBe('true');expect(localStorage.length).toBe(1);clearNotificationSound();expect(close).toHaveBeenCalledTimes(1);}finally{vi.unstubAllGlobals();}
});

it("keeps an initially empty Professional inbox and later historical pages silent", async () => {
  vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 9, 24, 10, 5));
  localStorage.setItem("echo:notification-sounds:a", "true");
  const play = vi.fn();
  await observe("a", [], play, settings, "professional:org");
  await observe("a", [notice("old-chat", 1)], play, settings, "professional:org");
  expect(play).not.toHaveBeenCalled();
  await observe("a", [notice("fresh-appointment", 6)], play, settings, "professional:org");
  await observe("a", [notice("fresh-appointment", 6)], play, settings, "professional:org");
  expect(play).toHaveBeenCalledTimes(1);
});

it("does not play for updates discovered in a hidden tab or replay them on visibility", async () => {
  localStorage.setItem("echo:notification-sounds:a", "true");
  const play = vi.fn();
  await observe("a", [notice("baseline", 1)], play, settings, "professional:org");
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  await observe("a", [notice("hidden-chat", 2)], play, settings, "professional:org");
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  await observe("a", [notice("hidden-chat", 2)], play, settings, "professional:org");
  expect(play).not.toHaveBeenCalled();
});

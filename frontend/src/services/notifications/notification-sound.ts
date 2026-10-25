import type { NotificationSettings } from "@/features/settings/model/settings.model";
type Notice = { id: string; createdAt: string; readAt: string | null };
let actor = "",
  epoch = 0,
  audio: AudioContext | null = null;
let seen = new Set<string>();
const baselines = new Map<string, number>();
const key = (id: string) => "echo:notification-sounds:" + id;
export function forgetNotificationSource(source: string) {
  epoch++;
  baselines.delete(source);
  seen.clear();
}
export function soundEnabled(id: string) {
  try {
    return !!id && localStorage.getItem(key(id)) === "true";
  } catch {
    return false;
  }
}
export function clearNotificationSound() {
  actor = "";
  epoch++;
  seen.clear();
  baselines.clear();
  if (audio) {
    void audio.close().catch(() => {});
    audio = null;
  }
}
export function soundActor(id: string) {
  if (actor !== id) {
    clearNotificationSound();
    actor = id;
  }
}
export function quietNow(
  settings: Pick<NotificationSettings, "quietHoursStart" | "quietHoursEnd" | "reminderTimezone">,
  now = new Date(),
) {
  const start = settings.quietHoursStart,
    end = settings.quietHoursEnd;
  if (!start || !end) return false;
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: settings.reminderTimezone || undefined,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(now);
    return start === end || (start < end ? parts >= start && parts < end : parts >= start || parts < end);
  } catch {
    return true;
  }
}
async function chime(unlock = false) {
  try {
    if (unlock) {
      audio ??= new AudioContext();
      await audio.resume();
    }
    if (!audio || audio.state !== "running") return false;
    const start = audio.currentTime;
    [523.25, 659.25].forEach((frequency, index) => {
      const oscillator = audio!.createOscillator(),
        gain = audio!.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start + index * 0.07);
      gain.gain.linearRampToValueAtTime(0.035, start + index * 0.07 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35 + index * 0.07);
      oscillator.connect(gain);
      gain.connect(audio!.destination);
      oscillator.start(start + index * 0.07);
      oscillator.stop(start + 0.4 + index * 0.07);
    });
    return true;
  } catch {
    return false;
  }
}
export async function enableNotificationSound(id: string, enabled: boolean) {
  soundActor(id);
  try {
    localStorage.setItem(key(id), String(enabled));
  } catch {
    /* The choice remains unavailable when storage is blocked. */
  }
  return !enabled || chime(true);
}
export async function testNotificationSound(id: string) {
  soundActor(id);
  return chime(true);
}
/** Only IDs/timestamps in session memory. A source's initial snapshot is always silent. */
export async function observeNotificationSound(
  id: string,
  source: string,
  items: Notice[],
  policy: () => Promise<NotificationSettings>,
  play = () => chime(),
) {
  if (!id) return;
  soundActor(id);
  const current = epoch;
  const watermark = baselines.get(source);
  // An empty first page must not turn subsequently discovered historical items into new arrivals.
  const newest = Math.max(watermark ?? (items.length ? 0 : Date.now()), ...items.map((item) => Date.parse(item.createdAt) || 0));
  baselines.set(source, newest);
  const candidates = items.filter(
    (item) => !item.readAt && !seen.has(item.id) && watermark !== undefined && Date.parse(item.createdAt) > watermark,
  );
  items.forEach((item) => seen.add(item.id));
  if (seen.size > 1000) seen = new Set([...seen].slice(-500));
  if (!candidates.length || !soundEnabled(id) || document.visibilityState === "hidden") return;
  try {
    const settings = await policy();
    if (
      current !== epoch ||
      actor !== id ||
      !soundEnabled(id) ||
      !settings.inAppEnabled ||
      quietNow(settings) ||
      document.hidden
    )
      return;
    await play();
  } catch {
    /* Visual notifications remain independent of audio/settings failures. */
  }
}

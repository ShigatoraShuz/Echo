import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { decryptText, encryptText, type EncryptionService } from "../../infrastructure/encryption/encryption.service.js";
import { ExternalServiceError } from "../../shared/errors/app-error.js";

export const dailyDistressRating = z.enum(["low", "moderate", "high"]);
type Rating = z.infer<typeof dailyDistressRating>;
type EmotionResult = { entryAt: string; emotion: string | null };
const difficultEmotions = new Set(["sadness", "fear", "anger", "disgust", "anxiety"]);

function dayAt(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  return ["year", "month", "day"].map(type => parts.find(part => part.type === type)!.value).join("-");
}

function offsetDay(day: string, offset: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function reachesSupportStreak(today: string, timezone: string, ratings: ReadonlyMap<string, Rating>, results: EmotionResult[]) {
  const emotions = new Map<string, boolean>();
  for (const result of results) {
    const day = dayAt(new Date(result.entryAt), timezone);
    const difficult = result.emotion !== null && difficultEmotions.has(result.emotion);
    emotions.set(day, (emotions.get(day) ?? true) && difficult);
  }
  const qualifies = (offset: number) => {
    const day = offsetDay(today, offset);
    return ratings.get(day) === "high" && emotions.get(day) === true;
  };
  return qualifies(0) && qualifies(-1) && qualifies(-2) && !qualifies(-3);
}

function check(error: unknown) {
  if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Your daily check-in is temporarily unavailable.");
}

export class DailyDistressService {
  constructor(
    private readonly database: SupabaseClient,
    private readonly encryption: EncryptionService,
    private readonly readEmotions: (userId: string, from: string, to: string) => Promise<EmotionResult[]>,
  ) {}

  private async calendar(userId: string) {
    const { data, error } = await this.database.schema("user_service").from("profiles")
      .select("timezone").eq("user_id", userId).maybeSingle();
    check(error);
    const now = new Date();
    const timezone = data?.timezone || "Asia/Manila";
    try { return { now, timezone, today: dayAt(now, timezone) }; }
    catch (error) {
      if (!(error instanceof RangeError)) throw error;
      return { now, timezone: "Asia/Manila", today: dayAt(now, "Asia/Manila") };
    }
  }

  private get checkins() { return this.database.schema("user_service").from("daily_distress_checkins"); }

  async get(userId: string) {
    const { today } = await this.calendar(userId);
    const { data, error } = await this.checkins.select("rating_ciphertext").eq("user_id", userId).eq("local_date", today).maybeSingle();
    check(error);
    return { rating: data ? dailyDistressRating.parse(decryptText(data.rating_ciphertext, this.encryption)) : null };
  }

  async save(userId: string, rating: Rating) {
    const { today } = await this.calendar(userId);
    const { error } = await this.checkins.upsert({
      user_id: userId, local_date: today, rating_ciphertext: encryptText(rating, this.encryption),
    }, { onConflict: "user_id,local_date" });
    check(error);
    return { rating };
  }

  async suggest(userId: string) {
    const { now, timezone, today } = await this.calendar(userId);
    const { data, error } = await this.checkins.select("local_date,rating_ciphertext")
      .eq("user_id", userId).gte("local_date", offsetDay(today, -3)).lte("local_date", today);
    check(error);
    if (!data || data.length < 3) return;
    const ratings = new Map<string, Rating>(data.map(row => [row.local_date, dailyDistressRating.parse(decryptText(row.rating_ciphertext, this.encryption))]));
    if ([0, -1, -2].some(offset => ratings.get(offsetDay(today, offset)) !== "high")) return;

    const preference = await this.database.schema("user_service").from("notification_preferences")
      .select("in_app_enabled").eq("user_id", userId).maybeSingle();
    check(preference.error);
    if (preference.data?.in_app_enabled !== true) return;

    const notifications = this.database.schema("notification_service").from("notifications");
    const existing = await notifications.select("id").eq("user_id", userId)
      .eq("notification_type", "daily_distress_suggestion").eq("reminder_local_date", today).maybeSingle();
    check(existing.error);
    if (existing.data) return;

    const results = await this.readEmotions(userId, `${offsetDay(today, -4)}T00:00:00Z`, now.toISOString());
    if (!reachesSupportStreak(today, timezone, ratings, results)) return;
    const notice = await notifications.upsert({
      user_id: userId,
      notification_type: "daily_distress_suggestion",
      title: "Make room for how you feel",
      message: "The past few days may have felt heavy. If you’d like space to express what you’re feeling, try writing a reflection or chatting with Buddy.",
      reminder_local_date: today,
    }, { onConflict: "user_id,notification_type,reminder_local_date", ignoreDuplicates: true });
    check(notice.error);
  }
}

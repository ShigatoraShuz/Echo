import type { SupabaseClient } from "@supabase/supabase-js";
import {
  decryptText,
  encryptText,
  type EncryptionService,
} from "../../infrastructure/encryption/encryption.service.js";
import { ExternalServiceError, NotFoundError } from "../../shared/errors/app-error.js";

export interface CalendarItemInput {
  scheduledOn: string;
  scheduledTime: string | null;
  kind: "reminder" | "note";
  content: string;
}

type CalendarRow = {
  id: string;
  scheduled_on: string;
  scheduled_time: string | null;
  kind: "reminder" | "note";
  content_ciphertext: string;
  completed_at: string | null;
};

export class CalendarService {
  constructor(
    private readonly database: SupabaseClient,
    private readonly encryption: EncryptionService,
  ) {}

  private table() {
    return this.database.schema("user_service").from("calendar_items");
  }

  private reveal(row: CalendarRow) {
    return {
      id: row.id,
      scheduledOn: row.scheduled_on,
      scheduledTime: row.scheduled_time?.slice(0, 5) ?? null,
      kind: row.kind,
      content: decryptText(row.content_ciphertext, this.encryption),
      completedAt: row.completed_at,
    };
  }

  async list(userId: string, from: string, to: string) {
    const { data, error } = await this.table()
      .select("id,scheduled_on,scheduled_time,kind,content_ciphertext,completed_at")
      .eq("user_id", userId)
      .gte("scheduled_on", from)
      .lte("scheduled_on", to)
      .order("scheduled_on")
      .order("scheduled_time");
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "Calendar items could not be loaded.");
    return ((data ?? []) as CalendarRow[]).map((row) => this.reveal(row));
  }

  async create(userId: string, input: CalendarItemInput) {
    const { data, error } = await this.table()
      .insert({
        user_id: userId,
        scheduled_on: input.scheduledOn,
        scheduled_time: input.scheduledTime,
        kind: input.kind,
        content_ciphertext: encryptText(input.content, this.encryption),
      })
      .select("id,scheduled_on,scheduled_time,kind,content_ciphertext,completed_at")
      .single();
    if (error || !data) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "The calendar item could not be saved.");
    return this.reveal(data as CalendarRow);
  }

  async update(userId: string, id: string, input: CalendarItemInput & { completed: boolean }) {
    const { data, error } = await this.table()
      .update({
        scheduled_on: input.scheduledOn,
        scheduled_time: input.scheduledTime,
        kind: input.kind,
        content_ciphertext: encryptText(input.content, this.encryption),
        completed_at: input.completed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("id", id)
      .select("id,scheduled_on,scheduled_time,kind,content_ciphertext,completed_at")
      .maybeSingle();
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "The calendar item could not be updated.");
    if (!data) throw new NotFoundError("The calendar item was not found.");
    return this.reveal(data as CalendarRow);
  }

  async remove(userId: string, id: string) {
    const { data, error } = await this.table().delete().eq("user_id", userId).eq("id", id).select("id").maybeSingle();
    if (error) throw new ExternalServiceError("DATABASE_UNAVAILABLE", "The calendar item could not be removed.");
    if (!data) throw new NotFoundError("The calendar item was not found.");
    return { id };
  }
}

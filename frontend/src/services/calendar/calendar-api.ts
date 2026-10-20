import { env } from "@/config/environment";
import { createApiClient } from "@/infrastructure/api/api-client";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";

export interface CalendarItem {
  id: string;
  scheduledOn: string;
  scheduledTime: string | null;
  kind: "reminder" | "note";
  content: string;
  completedAt: string | null;
}

export type CalendarItemInput = Pick<CalendarItem, "scheduledOn" | "scheduledTime" | "kind" | "content">;

const client = createApiClient({ baseUrl: env.apiBaseUrl, tokenProvider: supabaseAuthTokenProvider });

export const calendarApi = {
  async list(from: string, to: string, signal?: AbortSignal) {
    const query = new URLSearchParams({ from, to });
    return (await client.get<{ data: CalendarItem[] }>(`/calendar/items?${query}`, { signal })).data;
  },
  async create(input: CalendarItemInput) {
    return (await client.post<{ data: CalendarItem }, CalendarItemInput>("/calendar/items", input)).data;
  },
  async update(item: CalendarItem, completed: boolean) {
    const { id, scheduledOn, scheduledTime, kind, content } = item;
    return (
      await client.put<{ data: CalendarItem }, CalendarItemInput & { completed: boolean }>(`/calendar/items/${id}`, {
        scheduledOn,
        scheduledTime,
        kind,
        content,
        completed,
      })
    ).data;
  },
  async remove(id: string) {
    await client.delete(`/calendar/items/${id}`);
  },
};

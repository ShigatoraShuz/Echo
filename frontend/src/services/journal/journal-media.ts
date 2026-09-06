import { env } from "@/config/environment";
import { createApiClient } from "@/infrastructure/api/api-client";
import { supabaseAuthTokenProvider } from "@/infrastructure/api/supabase-auth-token-provider";
import type { JournalEntryResponseDTO } from "@/features/journal/model/journal.dto";
import { mapEntryResponseToDomain } from "@/features/journal/model/journal.mapper";
export interface JournalAttachment {
  id: string;
  url: string;
  mimeType: string;
  size: number;
  displayOrder: number;
}
const client = createApiClient({ baseUrl: env.apiBaseUrl, tokenProvider: supabaseAuthTokenProvider });
const path = (id: string, draft: boolean) =>
  "/journals/" + (draft ? "draft/" : "") + encodeURIComponent(id) + "/attachments";
export const journalMedia = {
  async list(id: string, draft = false) {
    return (await client.get<{ data: JournalAttachment[] }>(path(id, draft))).data;
  },
  async upload(id: string, file: File) {
    return (
      await client.post<{ data: JournalAttachment[] }>(path(id, true), file, { headers: { "Content-Type": file.type } })
    ).data;
  },
  async remove(id: string) {
    await client.delete("/journals/attachments/" + encodeURIComponent(id));
  },
  async finalize(id: string) {
    return mapEntryResponseToDomain(
      (await client.post<{ data: JournalEntryResponseDTO }>("/journals/draft/" + encodeURIComponent(id) + "/submit"))
        .data,
    );
  },
};

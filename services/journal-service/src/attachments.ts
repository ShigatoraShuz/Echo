import { randomUUID } from "node:crypto";
import { ServiceError, type OwnedDatabase } from "@echo/service-core";
export function validateImage(body: Buffer, mime: string) {
  if (!Buffer.isBuffer(body) || !body.length || body.length > 5242880)
    throw new ServiceError(400, "INVALID_IMAGE", "Images must be between 1 byte and 5 MB.");
  const valid =
    mime === "image/png"
      ? body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : mime === "image/jpeg"
        ? body[0] === 255 && body[1] === 216 && body[2] === 255
        : mime === "image/webp"
          ? body.toString("ascii", 0, 4) === "RIFF" && body.toString("ascii", 8, 12) === "WEBP"
          : false;
  if (!valid) throw new ServiceError(400, "INVALID_IMAGE", "Choose a valid JPEG, PNG, or WebP image.");
}
export class Attachments {
  constructor(
    private db: OwnedDatabase,
    private storage: OwnedDatabase["storage"],
  ) {}
  private async parent(userId: string, parentId: string, draft: boolean) {
    let query = this.db
      .from(draft ? "journal_drafts" : "journals")
      .select("id")
      .eq("id", parentId)
      .eq("user_id", userId);
    if (!draft) query = query.is("deleted_at", null);
    const { data, error } = await query.maybeSingle();
    if (error) throw new ServiceError(503, "DATABASE_UNAVAILABLE", "Journal ownership could not be checked.");
    if (!data) throw new ServiceError(404, "NOT_FOUND", "This journal or draft was not found.");
  }
  async list(userId: string, parentId: string, draft = false) {
    await this.parent(userId, parentId, draft);
    const { data, error } = await this.db
      .from("journal_attachments")
      .select("*")
      .eq("user_id", userId)
      .eq(draft ? "draft_id" : "journal_id", parentId)
      .order("display_order");
    if (error) throw new ServiceError(503, "DATABASE_UNAVAILABLE", "Images could not be loaded.");
    return Promise.all(
      (data ?? []).map(async (row) => {
        const signed = await this.storage.from("journal-images").createSignedUrl(row.storage_path, 300);
        if (signed.error || !signed.data)
          throw new ServiceError(503, "STORAGE_UNAVAILABLE", "Private image previews are temporarily unavailable.");
        return {
          id: row.id,
          mimeType: row.mime_type,
          size: row.size_bytes,
          displayOrder: row.display_order,
          url: signed.data.signedUrl,
        };
      }),
    );
  }
  async upload(userId: string, parentId: string, draft: boolean, body: Buffer, mime: string) {
    validateImage(body, mime);
    await this.parent(userId, parentId, draft);
    const attachmentId = randomUUID();
    const path = userId + "/" + parentId + "/" + attachmentId;
    const uploaded = await this.storage.from("journal-images").upload(path, body, { contentType: mime, upsert: false });
    if (uploaded.error) throw new ServiceError(503, "STORAGE_UNAVAILABLE", "The image could not be uploaded.");
    const { error } = await this.db.from("journal_attachments").insert({
      id: attachmentId,
      user_id: userId,
      [draft ? "draft_id" : "journal_id"]: parentId,
      storage_path: path,
      mime_type: mime,
      size_bytes: body.length,
      display_order: Date.now(),
    });
    if (error) {
      await this.storage.from("journal-images").remove([path]);
      throw new ServiceError(503, "DATABASE_UNAVAILABLE", "The attachment could not be saved.");
    }
    return this.list(userId, parentId, draft);
  }
  async remove(userId: string, attachmentId: string) {
    const { data, error } = await this.db
      .from("journal_attachments")
      .select("*")
      .eq("user_id", userId)
      .eq("id", attachmentId)
      .maybeSingle();
    if (error) throw new ServiceError(503, "DATABASE_UNAVAILABLE", "The image could not be loaded.");
    if (!data) throw new ServiceError(404, "NOT_FOUND", "The image was not found.");
    const removed = await this.storage.from("journal-images").remove([data.storage_path]);
    if (removed.error)
      throw new ServiceError(503, "STORAGE_UNAVAILABLE", "The image could not be removed. Please retry.");
    const result = await this.db.from("journal_attachments").delete().eq("user_id", userId).eq("id", attachmentId);
    if (result.error)
      throw new ServiceError(503, "DATABASE_UNAVAILABLE", "The attachment could not be removed. Please retry.");
  }
  async removeAll(userId: string, parentId: string, draft: boolean) {
    const { data, error } = await this.db
      .from("journal_attachments")
      .select("id")
      .eq("user_id", userId)
      .eq(draft ? "draft_id" : "journal_id", parentId);
    if (error) throw new ServiceError(503, "DATABASE_UNAVAILABLE", "Images could not be removed.");
    for (const item of data ?? []) await this.remove(userId, item.id);
  }
}
